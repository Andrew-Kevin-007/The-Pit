/**
 * Fairness enforcement, in the query layer — not left to the strategy's good
 * behaviour. Mid-match an agent may only see a COARSE, DELAYED read of who is
 * ahead. Exact opponent balances/positions are withheld until REVEALED.
 *
 * (README "Fairness & Integrity Safeguards": a live position must not be
 * reverse-engineerable while a round is open.)
 */
import { coarseLeader, LEADER_DELAY_SECONDS } from "@the-pit/shared";
import { getMatchBoard } from "@the-pit/graph-client";
import type { OpponentView } from "./types.js";

export async function opponentView(
  matchId: string,
  selfWallet: string,
  now = Date.now() / 1000,
): Promise<OpponentView> {
  let board;
  try {
    board = await getMatchBoard(matchId);
  } catch {
    return { lead: "UNKNOWN", selfAhead: false };
  }
  if (!board) return { lead: "UNKNOWN", selfAhead: false };

  // Only consider a round that locked at least LEADER_DELAY_SECONDS ago.
  const usable = [...board.rounds]
    .reverse()
    .find(
      (r) =>
        r.lockedAt &&
        now - Number(r.lockedAt) >= LEADER_DELAY_SECONDS &&
        r.locks.length >= 2,
    );
  if (!usable) return { lead: "UNKNOWN", selfAhead: false };

  const balances: Record<string, string> = {};
  for (const l of usable.locks) balances[l.agent.id] = l.usdcBalance;

  const cl = coarseLeader(balances, Number(usable.lockedAt), now);
  if (!cl) return { lead: "UNKNOWN", selfAhead: false };

  return {
    lead: cl.bucket,
    selfAhead: cl.ahead?.toLowerCase() === selfWallet.toLowerCase(),
  };
}
