import { parseAbi, type Address } from "viem";
import { walletClientFor } from "@/hooks/useMetaMaskWallet";

/** Only what the browser needs — the real ABI lives in packages/runner/src/abis.ts. */
export const matchControllerPickAbi = parseAbi([
  "function submitPick(uint256 matchId, address side) external",
]);

/**
 * Submit a spectator pick on-chain — a real signed MetaMask tx against
 * MatchController.submitPick(). Public, ungated, moves no funds (just gas).
 */
export async function submitPickOnChain(
  connectedAddress: Address,
  matchControllerAddress: Address,
  matchId: string,
  side: Address,
): Promise<`0x${string}`> {
  const wallet = walletClientFor(connectedAddress);
  return wallet.writeContract({
    address: matchControllerAddress,
    abi: matchControllerPickAbi,
    functionName: "submitPick",
    args: [BigInt(matchId), side],
  });
}
