/**
 * Real agent wallets deplete their USDC stake match over match. Before
 * registering, top any short agent back up above STAKE_USDC by swapping a
 * little of the WETH it already holds (accumulated from past matches'
 * trading) through Uniswap's SwapRouter02 — verified on-chain: its factory()
 * matches this project's own UNISWAP_V3_FACTORY_ADDRESS.
 */
import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { STAKE_USDC } from "@the-pit/shared";
import { erc20Abi, swapRouter02Abi, SWAP_ROUTER02_ADDRESS } from "./abis.js";

const WETH_ADDRESS = "0x4200000000000000000000000000000000000006" as const; // OP-stack predeploy
const POOL_FEE = 3000;
const TOP_UP_AMOUNT_IN = 100_000_000_000_000n; // 0.0001 WETH

export async function ensureStaked(privateKey: `0x${string}`, usdc: Address, rpcUrl: string): Promise<void> {
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });

  const balance = await publicClient.readContract({
    address: usdc,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account.address],
  });
  if (balance >= STAKE_USDC) return;

  const allowance = await publicClient.readContract({
    address: WETH_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account.address, SWAP_ROUTER02_ADDRESS],
  });
  if (allowance < TOP_UP_AMOUNT_IN) {
    const approveHash = await walletClient.writeContract({
      address: WETH_ADDRESS,
      abi: erc20Abi,
      functionName: "approve",
      args: [SWAP_ROUTER02_ADDRESS, TOP_UP_AMOUNT_IN * 1000n],
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });
  }

  const swapHash = await walletClient.writeContract({
    address: SWAP_ROUTER02_ADDRESS,
    abi: swapRouter02Abi,
    functionName: "exactInputSingle",
    args: [
      {
        tokenIn: WETH_ADDRESS,
        tokenOut: usdc,
        fee: POOL_FEE,
        recipient: account.address,
        amountIn: TOP_UP_AMOUNT_IN,
        amountOutMinimum: 150_000n, // 0.15 USDC min out — plenty of slippage room
        sqrtPriceLimitX96: 0n,
      },
    ],
  });
  await publicClient.waitForTransactionReceipt({ hash: swapHash });

  // the public RPC is load-balanced across nodes without strong
  // read-your-writes consistency — poll a few times before giving up.
  for (let i = 0; i < 5; i++) {
    const after = await publicClient.readContract({
      address: usdc,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [account.address],
    });
    if (after >= STAKE_USDC) return;
    await new Promise((r) => setTimeout(r, 3000));
  }
  throw new Error(`agent ${account.address} still short of stake after top-up swap`);
}
