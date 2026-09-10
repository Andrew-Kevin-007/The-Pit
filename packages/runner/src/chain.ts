import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { erc20Abi } from "./abis.js";
import type { RunnerEnv } from "./env.js";

export function publicClient(env: RunnerEnv) {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(env.rpcUrl),
  });
}

export function walletClient(env: RunnerEnv & { runnerPk: `0x${string}` }) {
  return createWalletClient({
    account: privateKeyToAccount(env.runnerPk),
    chain: baseSepolia,
    transport: http(env.rpcUrl),
  });
}

/** Round-lock reads balances directly on-chain — no oracle (USDC == $1). */
export async function readUsdcBalance(
  env: RunnerEnv,
  usdc: Address,
  wallet: Address,
): Promise<bigint> {
  return publicClient(env).readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [wallet],
  });
}
