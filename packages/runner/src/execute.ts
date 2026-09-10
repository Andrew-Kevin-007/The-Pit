/**
 * Turns a Strategy's `Action` (from @the-pit/agent) into a real PitRouter.swap()
 * call, signed by the agent's OWN wallet — never the runner's. This is the
 * "execute" the tick loop's LoopConfig leaves abstract (packages/agent/src/tickLoop.ts).
 *
 * Sizing: `sizePct` is a percentage of the agent's own current balance of
 * whichever token it's about to sell (USDC if zeroForOne, WETH otherwise),
 * capped so a strategy can never accidentally swap a disproportionate chunk of
 * a WETH balance an agent happened to accumulate from past matches — this is a
 * $1-stake game, trades stay tiny regardless of what sizePct asks for.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { Action } from "@the-pit/agent";
import { erc20Abi, pitRouterAbi } from "./abis.js";

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const; // OP-stack predeploy
const MIN_SQRT_RATIO_PLUS_1 = 4295128740n;
const MAX_SQRT_RATIO_MINUS_1 = 1461446703485210103287273052203988822378723970341n;
const USDC_TRADE_CAP = 50_000n; // 0.05 USDC per trade, regardless of sizePct
const WETH_TRADE_CAP = 20_000_000_000_000n; // ~0.00002 WETH per trade

export interface ExecutorOptions {
  agentPrivateKey: `0x${string}`;
  matchId: string;
  pitRouter: Address;
  usdc: Address;
  rpcUrl: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The public RPC is load-balanced across nodes without strong
 * read-your-writes consistency — a call can revert (or its receipt come back
 * "reverted") against a node that hasn't yet seen a just-confirmed prior tx,
 * then succeed seconds later with no code change. Retry the whole call
 * (fresh tx, fresh nonce) rather than trusting the first attempt.
 */
interface ReceiptWaiter {
  waitForTransactionReceipt: (args: { hash: `0x${string}` }) => Promise<{ status: "success" | "reverted" }>;
}

async function sendAndConfirm(
  publicClient: ReceiptWaiter,
  label: string,
  send: () => Promise<`0x${string}`>,
  tries = 3,
): Promise<`0x${string}`> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const hash = await send();
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === "success") return hash;
      lastErr = new Error(`${label} reverted on-chain, tx ${hash}`);
    } catch (e) {
      lastErr = e;
    }
    if (i < tries - 1) await sleep(4000);
  }
  throw lastErr;
}

/** One executor per agent — bound to that agent's own signer. */
export function createPitRouterExecutor(opts: ExecutorOptions) {
  const account = privateKeyToAccount(opts.agentPrivateKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(opts.rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(opts.rpcUrl) });

  async function ensureAllowance(token: Address, spender: Address, minAmount: bigint) {
    const current = await publicClient.readContract({
      address: token,
      abi: erc20Abi,
      functionName: "allowance",
      args: [account.address, spender],
    });
    if (current >= minAmount) return;
    await sendAndConfirm(publicClient, "approve", () =>
      walletClient.writeContract({
        address: token,
        abi: erc20Abi,
        functionName: "approve",
        args: [spender, minAmount * 1000n],
      }),
    );
  }

  return async function execute(action: Extract<Action, { kind: "swap" }>): Promise<string | undefined> {
    const inputToken = action.zeroForOne ? opts.usdc : WETH_ADDRESS;
    const cap = action.zeroForOne ? USDC_TRADE_CAP : WETH_TRADE_CAP;

    const balance = await publicClient.readContract({
      address: inputToken,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    const pct = BigInt(Math.max(1, Math.min(100, Math.round(action.sizePct))));
    const fromPct = (balance * pct) / 100n;
    const amountSpecified = fromPct < cap ? fromPct : cap;
    if (amountSpecified <= 0n) return undefined; // nothing worth trading this round

    await ensureAllowance(inputToken, opts.pitRouter, amountSpecified);

    const sqrtPriceLimitX96 = action.zeroForOne ? MIN_SQRT_RATIO_PLUS_1 : MAX_SQRT_RATIO_MINUS_1;
    return sendAndConfirm(publicClient, "swap", () =>
      walletClient.writeContract({
        address: opts.pitRouter,
        abi: pitRouterAbi,
        functionName: "swap",
        args: [BigInt(opts.matchId), action.zeroForOne, amountSpecified, sqrtPriceLimitX96],
      }),
    );
  };
}
