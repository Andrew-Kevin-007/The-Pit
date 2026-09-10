import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchState } from "@the-pit/shared";
import type { RunnerEnv } from "./env.js";

/**
 * The runner is the single writer of board state. It pushes a full MatchState
 * snapshot after every transition; the web board subscribes via Supabase
 * Realtime. Table: `board_state (match_id text pk, state jsonb, updated_at)`.
 */
export function boardClient(env: RunnerEnv): SupabaseClient | null {
  if (!env.supabaseUrl || !env.supabaseServiceKey) return null;
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

export async function pushBoard(
  sb: SupabaseClient | null,
  state: MatchState,
): Promise<void> {
  if (!sb) {
    console.log(`[board] (no supabase) ${state.matchId} -> ${state.status}`);
    return;
  }
  const { error } = await sb
    .from("board_state")
    .upsert(
      { match_id: state.matchId, state, updated_at: new Date().toISOString() },
      { onConflict: "match_id" },
    );
  if (error) console.error("[board] push failed:", error.message);
}

/**
 * A per-agent, per-match performance snapshot written the instant a match
 * settles — queryable/realtime long before the subgraph finishes indexing
 * MatchSettled. The subgraph stays the tamper-proof record; this is the fast
 * benchmark view in front of it. Table: `agent_benchmarks` (supabase/schema.sql).
 */
export async function recordBenchmarks(
  sb: SupabaseClient | null,
  state: MatchState,
  strategyByWallet: Record<string, string>,
  tradesByWallet: Record<string, number>,
): Promise<void> {
  if (!sb) {
    console.log(`[benchmark] (no supabase) ${state.matchId} settled — skipping`);
    return;
  }
  const rows = state.results.map((r) => ({
    match_id: state.matchId,
    agent: r.wallet,
    handle: state.agents.find((a) => a.wallet === r.wallet)?.handle ?? null,
    strategy: strategyByWallet[r.wallet] ?? null,
    final_usdc: r.finalUsdc,
    pnl: r.pnl,
    rebate: r.rebate,
    won: r.won,
    trades_total: tradesByWallet[r.wallet] ?? 0,
    settled_at: new Date().toISOString(),
  }));
  const { error } = await sb.from("agent_benchmarks").upsert(rows, { onConflict: "match_id,agent" });
  if (error) console.error("[benchmark] push failed:", error.message);
}
