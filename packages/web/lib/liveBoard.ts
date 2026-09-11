/**
 * Phase 2 — build a MatchState from the LIVE subgraph when Supabase has nothing
 * (e.g. the runner isn't pushing, or we want the board sourced straight from the
 * proof record). Coarsening/delay is still applied client-side by the board.
 */
import { getMatchBoard } from "@the-pit/graph-client";
import {
  emptyRounds,
  type MatchState,
  type RoundIndex,
} from "@the-pit/shared";

export async function liveBoard(matchId: string): Promise<MatchState | null> {
  let sg;
  try {
    sg = await getMatchBoard(matchId);
  } catch {
    return null;
  }
  if (!sg) return null;

  const rounds = emptyRounds();
  for (const r of sg.rounds) {
    const idx = r.roundIndex as RoundIndex;
    if (idx < 0 || idx > 5) continue;
    rounds[idx]!.lockedAt = r.lockedAt ? Number(r.lockedAt) : null;
    for (const lock of r.locks) {
      rounds[idx]!.balances[lock.agent.id] = lock.usdcBalance;
    }
  }

  return {
    matchId: sg.id,
    status: sg.status as MatchState["status"],
    poolId: sg.poolId,
    createdAt: 0,
    startTime: null,
    settledAt: null,
    agents: sg.participants.map((p) => ({
      wallet: p.id,
      handle: p.id.slice(0, 8),
      strategy: "unknown",
    })),
    currentRound: null,
    rounds,
    results: sg.results.map((r) => ({
      wallet: r.agent.id,
      finalUsdc: r.finalUsdc,
      pnl: r.pnl,
      rebate: r.rebate,
      won: r.won,
    })),
    winner: sg.winner?.id ?? null,
  };
}
