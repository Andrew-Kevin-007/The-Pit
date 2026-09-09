/**
 * Coarse + delayed leader signal for the PUBLIC board.
 *
 * Fairness rule (README "Fairness & Integrity Safeguards"): a live position must
 * not be reverse-engineerable from the public price feed while a round is open.
 * So the board never shows exact PnL mid-match — only:
 *   - a bucketed lead ("EDGE" / "SLIGHT EDGE" / "EVEN"), and
 *   - held back by LEADER_DELAY_SECONDS.
 * The record becomes exact only at REVEALED/SETTLED.
 */
import { STAKE_USDC } from "./stateModel.js";

export const LEADER_DELAY_SECONDS = 20;

export type LeadBucket = "EVEN" | "SLIGHT_EDGE" | "EDGE" | "STRONG_EDGE";

export interface CoarseLeader {
  /** wallet that is ahead, or null when EVEN */
  ahead: string | null;
  bucket: LeadBucket;
  /** unix seconds — the balances this was computed from are at least this old */
  asOf: number;
}

/** Bucket a PnL-delta (base units, 6dp USDC) between exactly two agents. */
export function bucketLead(deltaBaseUnits: bigint): LeadBucket {
  const abs = deltaBaseUnits < 0n ? -deltaBaseUnits : deltaBaseUnits;
  const pct = Number(abs) / Number(STAKE_USDC); // fraction of one stake
  if (pct < 0.01) return "EVEN";
  if (pct < 0.04) return "SLIGHT_EDGE";
  if (pct < 0.12) return "EDGE";
  return "STRONG_EDGE";
}

/**
 * @param balances     wallet -> USDC balance (base units) at time `sampledAt`
 * @param sampledAt    unix seconds the balances were read
 * @param now          unix seconds
 * Returns null while the sample is younger than LEADER_DELAY_SECONDS.
 */
export function coarseLeader(
  balances: Record<string, string>,
  sampledAt: number,
  now = Date.now() / 1000,
): CoarseLeader | null {
  if (now - sampledAt < LEADER_DELAY_SECONDS) return null;
  const entries = Object.entries(balances);
  if (entries.length < 2) return null;

  entries.sort((a, b) => (BigInt(b[1]) > BigInt(a[1]) ? 1 : -1));
  const [topWallet, topBal] = entries[0]!;
  const [, secondBal] = entries[1]!;
  const delta = BigInt(topBal) - BigInt(secondBal);
  const bucket = bucketLead(delta);
  return {
    ahead: bucket === "EVEN" ? null : topWallet,
    bucket,
    asOf: sampledAt,
  };
}

export const LEAD_LABEL: Record<LeadBucket, string> = {
  EVEN: "Neck and neck",
  SLIGHT_EDGE: "Slight edge",
  EDGE: "Clear edge",
  STRONG_EDGE: "Pulling away",
};
