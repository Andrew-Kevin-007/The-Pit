/**
 * The query -> reasoning -> decision chain.  (Graph Track 2 core — Suganthan)
 *
 * Before every round the agent:
 *   1. QUERIES its own on-chain track record + the pool's market state
 *      (composed across BOTH subgraphs — see @the-pit/graph-client/composed).
 *   2. REASONS over it in plain language — and that reasoning changes the action.
 *   3. DECIDES via the chosen strategy, bounded by the trade cap + opponent view.
 *
 * Every step is recorded in `Decision.chain`. That chain — not a raw query dump —
 * is what the AI track judges. In production the reasoning step is an LLM call
 * through the Claude Agent SDK with the Subgraph MCP attached; the deterministic
 * summariser here is the offline fallback and the thing tests assert on.
 */
import { buildRoundContext, describeContext, type RoundContext } from "@the-pit/graph-client";
import { getStrategy } from "./strategies/index.js";
import { opponentView } from "./opponentView.js";
import type { Decision, ReasoningStep, TickInput } from "./types.js";

function step(kind: ReasoningStep["kind"], detail: string, data?: unknown): ReasoningStep {
  return { at: new Date().toISOString(), kind, detail, data };
}

export interface ReasonDeps {
  strategyId: string;
  /** optional LLM hook: (context, priorSteps) => prose. If absent, use the rule-based summariser. */
  narrate?: (ctx: RoundContext, steps: ReasoningStep[]) => Promise<string>;
}

export async function reason(input: TickInput, deps: ReasonDeps): Promise<Decision> {
  const chain: ReasoningStep[] = [];

  // 1. QUERY (composed: the-pit-match + the-pit-messari)
  chain.push(step("query", `buildRoundContext(agent=${input.agent.slice(0, 8)}, pool=${input.poolId.slice(0, 10)})`));
  const ctx = await buildRoundContext(input.agent, input.poolId, input.roundStartUnix);
  chain.push(step("query", "composed context", ctx));

  chain.push(step("query", "opponentView (coarse + delayed only)"));
  const opp = await opponentView(input.matchId, input.agent);
  chain.push(step("query", "opponent view", opp));

  // 2. REASON
  const prose = deps.narrate
    ? await deps.narrate(ctx, chain)
    : ruleBasedReasoning(input, ctx, opp);
  chain.push(step("reason", prose));

  // 3. DECIDE
  const strat = getStrategy(deps.strategyId);
  const action =
    input.tradesThisRound >= input.maxTradesPerRound
      ? ({ kind: "hold", reason: "trade cap reached this round" } as const)
      : strat.decide(input, ctx, opp);
  chain.push(step("decide", `${strat.id}: ${action.kind}`, action));

  return {
    action,
    chain,
    commentary: sanitize(commentaryFrom(action, ctx, opp)),
  };
}

// ---- rule-based fallback reasoning (deterministic; tests assert on this) ----

function ruleBasedReasoning(input: TickInput, ctx: RoundContext, opp: { lead: string; selfAhead: boolean }): string {
  const bits: string[] = [];
  bits.push(describeContext(ctx));
  if (ctx.priorMatches === 0) {
    bits.push("No track record yet — trade conservatively this match to build one.");
  } else if (ctx.winRate < 0.34 && ctx.avgPnl < 0) {
    bits.push(
      `Losing record (${(ctx.winRate * 100).toFixed(0)}% wins, avg PnL ${ctx.avgPnl.toFixed(0)}). ` +
        `Recent trend ${ctx.lastFivePnl.join("/")}. Cut size and wait for a clean signal.`,
    );
  } else if (ctx.winRate > 0.6) {
    bits.push(`Strong record — the current approach is working; keep sizing normal.`);
  }
  if (ctx.recentSwapCount < 3) {
    bits.push("Thin recent flow in the pool; expect slippage, keep clips small.");
  }
  if (opp.lead === "STRONG_EDGE" && !opp.selfAhead) {
    bits.push("Behind by a clear margin (delayed read) — need a higher-conviction entry, not a coin flip.");
  }
  if (opp.selfAhead && (opp.lead === "EDGE" || opp.lead === "STRONG_EDGE")) {
    bits.push("Ahead — protect the lead, reduce exposure into the round lock.");
  }
  return bits.join(" ");
}

function commentaryFrom(action: { kind: string; reason?: string }, ctx: RoundContext, opp: { selfAhead: boolean }): string {
  if (action.kind === "hold") return `Sitting this one out — ${action.reason ?? "no edge"}.`;
  return opp.selfAhead
    ? "Trimming risk while ahead."
    : ctx.priorMatches > 0 && ctx.winRate < 0.34
      ? "Small size, only took it on a clean signal."
      : "Took the trade on the read.";
}

/** strip anything that could leak strategy internals or exact positions */
function sanitize(line: string): string {
  return line.replace(/\b0x[0-9a-fA-F]{6,}\b/g, "…").slice(0, 140);
}
