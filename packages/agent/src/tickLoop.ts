/**
 * The tick loop.  Owner: Sylesh (execution, timing, strategies).
 * Suganthan owns the `reason()` call it delegates to.
 *
 * Per round: while the clock is open and under the trade cap, build the composed
 * Graph context, reason over it, and act. Each decision's full chain is logged
 * (that log is a Track-2 deliverable) and the sanitized commentary line is
 * returned for the board.
 */
import { ROUND_SECONDS, secondsLeft, type RoundIndex } from "@the-pit/shared";
import { reason } from "./graphReasoning.js";
import type { Action, Decision } from "./types.js";

export interface LoopConfig {
  matchId: string;
  agent: string;
  poolId: string;
  strategyId: string;
  maxTradesPerRound: number;
  /** how the agent actually submits a swap (Amalraj + Sylesh freeze this) —
   *  resolves to the tx hash when a real trade goes through, or undefined
   *  (mock mode, or nothing worth trading this round). */
  execute: (a: Extract<Action, { kind: "swap" }>) => Promise<string | undefined>;
  /** tick cadence within a round */
  tickMs?: number;
  /** sink for the reasoning chain — file, stdout, or the runner */
  onDecision?: (round: RoundIndex, d: Decision) => void;
}

export async function runRound(
  cfg: LoopConfig,
  round: RoundIndex,
  roundStartUnix: number,
): Promise<Decision[]> {
  const decisions: Decision[] = [];
  let trades = 0;
  const tickMs = cfg.tickMs ?? 15_000;

  while (true) {
    const { round: cur, roundRemaining } = secondsLeft(roundStartUnix);
    if (cur !== round || roundRemaining <= 2) break; // round over

    const d = await reason(
      {
        matchId: cfg.matchId,
        agent: cfg.agent,
        poolId: cfg.poolId,
        round,
        roundStartUnix,
        tradesThisRound: trades,
        maxTradesPerRound: cfg.maxTradesPerRound,
      },
      { strategyId: cfg.strategyId },
    );
    decisions.push(d);
    cfg.onDecision?.(round, d);

    if (d.action.kind === "swap") {
      const txHash = await cfg.execute(d.action);
      if (txHash) d.txHash = txHash;
      trades += 1;
    }
    if (trades >= cfg.maxTradesPerRound) break;

    await sleep(Math.min(tickMs, roundRemaining * 1000));
  }
  return decisions;
}

export async function runMatchLoop(cfg: LoopConfig, matchStartUnix: number) {
  const all: Record<number, Decision[]> = {};
  for (let r = 0 as RoundIndex; r < 6; r = (r + 1) as RoundIndex) {
    const roundStart = matchStartUnix + r * ROUND_SECONDS;
    // wait until this round's window opens
    const waitMs = roundStart * 1000 - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    // secondsLeft() derives the current round from the MATCH's start, not a
    // per-round offset — passing roundStart here made runRound's internal
    // `cur !== round` check fail for every round after 0, silently skipping
    // all reasoning/trading. Pass the true match start instead.
    all[r] = await runRound(cfg, r, matchStartUnix);
  }
  return all;
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
