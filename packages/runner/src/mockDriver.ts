/**
 * Phase 1 — publish the mock match to Supabase and step it through the state
 * model on a timer so the board renders a "live" match before any contract
 * exists. No chain, no agent needed.
 */
import { MOCK_MATCH, ROUND_COUNT, type MatchState, type RoundIndex } from "@the-pit/shared";
import { STAKE_USDC } from "@the-pit/shared";
import { boardClient, pushBoard } from "./board.js";
import { loadEnv } from "./env.js";

export async function driveMock(stepMs = 4000): Promise<void> {
  const env = loadEnv();
  const sb = boardClient(env);
  const state: MatchState = structuredClone(MOCK_MATCH);
  state.startTime = Math.floor(Date.now() / 1000);
  state.status = "LIVE";

  console.log(`[mock] publishing match ${state.matchId}; stepping every ${stepMs}ms`);
  await pushBoard(sb, state);

  for (let r = 0 as RoundIndex; r < ROUND_COUNT; r = (r + 1) as RoundIndex) {
    state.currentRound = r;
    state.rounds[r]!.startedAt = Math.floor(Date.now() / 1000);
    await pushBoard(sb, state);
    await sleep(stepMs);

    for (let i = 0; i < state.agents.length; i++) {
      const w = state.agents[i]!.wallet;
      // scaled as a fraction of STAKE_USDC ($1) so the coarse-leader buckets
      // (1% / 4% / 12% of one stake) actually move across the match
      const drift = [52_000, -30_000, 0][i % 3]! * (r + 1);
      state.rounds[r]!.balances[w] = (STAKE_USDC + BigInt(drift)).toString();
      state.rounds[r]!.trades[w] = (i % 2) + (r % 2);
      state.rounds[r]!.commentary[w] = `round ${r}: ${state.agents[i]!.strategy} update`;
      state.rounds[r]!.txHashes[w] = [];
    }
    state.rounds[r]!.lockedAt = Math.floor(Date.now() / 1000);
    if (r === ROUND_COUNT - 1) state.status = "LOCKED";
    await pushBoard(sb, state);
    await sleep(stepMs);
  }

  state.currentRound = null;
  state.status = "REVEALED";
  await pushBoard(sb, state);
  await sleep(stepMs);

  const last = state.rounds[ROUND_COUNT - 1]!.balances;
  let winner = state.agents[0]!.wallet;
  for (const a of state.agents) {
    if (BigInt(last[a.wallet] ?? "0") > BigInt(last[winner] ?? "0")) winner = a.wallet;
  }
  state.winner = winner;
  state.settledAt = Math.floor(Date.now() / 1000);
  state.results = state.agents.map((a) => {
    const finalUsdc = last[a.wallet] ?? STAKE_USDC.toString();
    return {
      wallet: a.wallet,
      finalUsdc,
      pnl: (BigInt(finalUsdc) - STAKE_USDC).toString(),
      rebate: "12000",
      won: a.wallet === winner,
    };
  });
  state.status = "SETTLED";
  await pushBoard(sb, state);
  console.log(`[mock] done. winner=${winner}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
