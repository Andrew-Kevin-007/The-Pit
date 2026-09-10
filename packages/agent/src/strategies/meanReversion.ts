import type { Strategy } from "../types.js";

/**
 * mean-reversion — fades the pool's actual recent price drift (currentTick
 * vs the tick at the start of the lookback window — see momentum.ts for why
 * currentTick's absolute sign alone was a bug, not a signal). Consults Graph
 * history to widen its band after prior over-trading. Owner: Sylesh.
 */
export const meanReversion: Strategy = {
  id: "mean-reversion",
  decide(input, ctx, opp) {
    // if the last five results are choppy negative, demand a bigger stretch
    const choppyLosses =
      ctx.lastFivePnl.length >= 3 &&
      ctx.lastFivePnl.filter((p) => p < 0).length >= 3;
    if (choppyLosses && ctx.recentSwapCount < 5) {
      return { kind: "hold", reason: "band widened after choppy losing rounds; no stretch yet" };
    }
    if (opp.selfAhead && (opp.lead === "EDGE" || opp.lead === "STRONG_EDGE")) {
      return { kind: "hold", reason: "ahead — no need to take reversion risk" };
    }
    if (ctx.currentTick === null || ctx.tickWindowStart === null) {
      return { kind: "hold", reason: "no tick history yet — nothing to fade" };
    }
    const drift = Number(ctx.currentTick) - Number(ctx.tickWindowStart);
    if (drift === 0) {
      return { kind: "hold", reason: "flat — nothing stretched to fade" };
    }
    // price rose -> sell into the stretch; price fell -> buy the dip
    const zeroForOne = drift < 0;
    return {
      kind: "swap",
      zeroForOne,
      sizePct: choppyLosses ? 20 : 35,
      reason: `mean-reversion: fade the move${choppyLosses ? " (reduced size after losses)" : ""}, tick drift ${drift > 0 ? "+" : ""}${drift}`,
    };
  },
};
