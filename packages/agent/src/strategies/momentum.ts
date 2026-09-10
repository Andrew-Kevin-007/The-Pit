import type { Strategy } from "../types.js";

/**
 * momentum — trades WITH the pool's actual recent price drift (currentTick
 * vs the tick at the start of the lookback window, not just currentTick's
 * absolute sign — for a USDC/WETH pool that sign is ~always positive
 * regardless of any real trend, which was silently always buying WETH
 * every round). Uses Graph history to size down after a losing streak (this
 * is the "decision changes because of the query" part). Owner: Sylesh.
 */
export const momentum: Strategy = {
  id: "momentum",
  decide(input, ctx, opp) {
    if (opp.selfAhead && opp.lead === "STRONG_EDGE") {
      return { kind: "hold", reason: "protecting a strong lead into the lock" };
    }
    if (ctx.currentTick === null || ctx.tickWindowStart === null) {
      return { kind: "hold", reason: "no tick history yet — nothing to follow" };
    }
    const drift = Number(ctx.currentTick) - Number(ctx.tickWindowStart);
    if (drift === 0) {
      return { kind: "hold", reason: "flat — no drift to follow" };
    }
    const losing = ctx.priorMatches > 0 && ctx.winRate < 0.34 && ctx.avgPnl < 0;
    const thin = ctx.recentSwapCount < 3;
    const size = losing ? 15 : thin ? 25 : 40;
    // price rising (tick up) -> keep buying the trend; falling -> sell into it
    const zeroForOne = drift > 0;
    return {
      kind: "swap",
      zeroForOne,
      sizePct: size,
      reason: `momentum: ${losing ? "reduced size (losing record)" : thin ? "reduced size (thin flow)" : "normal size"}, tick drift ${drift > 0 ? "+" : ""}${drift}`,
    };
  },
};
