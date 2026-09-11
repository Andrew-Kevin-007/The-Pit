/**
 * Graph Track 1 deliverable: ONE analysis function, TWO Graph products.
 *
 *   @the-pit/subgraph-match     -> match / round / agent context   (custom subgraph)
 *   @the-pit/subgraph-messari   -> pool swaps + liquidity + tick    (Messari standard)
 *
 * Joined here on poolId. The market half reads only the generic Messari
 * `Swap` / `LiquidityPool` shape, so the analysis is protocol-agnostic: repoint
 * MESSARI_SUBGRAPH_URL at any other Messari DEX AMM subgraph and this function
 * still runs. Make that portability explicit in the demo — it is the "standards
 * leverage" the track asks you to show.
 *
 * Consumers:
 *  - the agent's per-round reasoning step (Track 2)
 *  - the public board's market strip
 */
import { getAgentHistory, type AgentResultRow } from "./matchSubgraph.js";
import { getPoolActivity } from "./messariSubgraph.js";
import { loadConfig, type GraphConfig } from "./config.js";

export interface RoundContext {
  agent: string;
  poolId: string;

  // from the custom subgraph
  priorMatches: number;
  priorWins: number;
  winRate: number;
  avgPnl: number;
  lastFivePnl: number[];

  // from the Messari standardized subgraph
  recentSwapCount: number;
  poolActiveLiquidity: string;
  currentTick: string | null;
  /** the pool's tick at the start of the lookback window (oldest swap in
   *  range) — compare against currentTick for a real drift signal. null
   *  when there's no swap history in the window (nothing to compare to). */
  tickWindowStart: string | null;
  cumulativeSwapCount: number;
}

function summarizeHistory(rows: AgentResultRow[]) {
  const priorWins = rows.filter((r) => r.won).length;
  const avgPnl =
    rows.length === 0
      ? 0
      : rows.reduce((s, r) => s + Number(r.pnl), 0) / rows.length;
  return {
    priorMatches: rows.length,
    priorWins,
    winRate: rows.length === 0 ? 0 : priorWins / rows.length,
    avgPnl,
    lastFivePnl: rows.slice(0, 5).map((r) => Number(r.pnl)),
  };
}

/**
 * Build the context an agent reasons over before it acts in a round.
 * `roundStartUnix` bounds the market lookback to the last hour of activity.
 */
export async function buildRoundContext(
  agent: string,
  poolId: string,
  roundStartUnix: number,
  cfg: GraphConfig = loadConfig(),
): Promise<RoundContext> {
  const [history, market] = await Promise.all([
    getAgentHistory(agent, 25, cfg),
    getPoolActivity(poolId, roundStartUnix - 3600, 100, cfg),
  ]);

  const h = summarizeHistory(history);
  const pool = market.liquidityPool;
  // swaps come back ordered by timestamp desc, so the last entry is the
  // oldest one in the lookback window — the baseline to diff currentTick
  // against for a real drift signal (see RoundContext.tickWindowStart).
  const oldestSwap = market.swaps[market.swaps.length - 1];

  return {
    agent,
    poolId,
    ...h,
    recentSwapCount: market.swaps.length,
    poolActiveLiquidity: pool?.activeLiquidity ?? "0",
    currentTick: pool?.tick ?? null,
    tickWindowStart: oldestSwap?.tick ?? null,
    cumulativeSwapCount: pool?.cumulativeSwapCount ?? 0,
  };
}

/** One-line summary — handy for the agent's commentary and the demo voiceover. */
export function describeContext(ctx: RoundContext): string {
  const wr = (ctx.winRate * 100).toFixed(0);
  return (
    `agent ${ctx.agent.slice(0, 8)} — ${ctx.priorWins}/${ctx.priorMatches} wins (${wr}%), ` +
    `avg PnL ${ctx.avgPnl.toFixed(0)}; pool ${ctx.poolId.slice(0, 10)} ` +
    `liq ${ctx.poolActiveLiquidity}, ${ctx.recentSwapCount} swaps in the last hour`
  );
}
