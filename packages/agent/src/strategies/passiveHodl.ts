import type { Strategy } from "../types.js";

/**
 * passive-hodl — the deliberately-different third agent (ideally someone else's).
 * Never trades; exists to prove the registration pipeline is generic and that
 * the fee rebate makes "do nothing" a real, scored baseline rather than an
 * automatic loss. Owner: guest / Sylesh.
 */
export const passiveHodl: Strategy = {
  id: "passive-hodl",
  decide() {
    return { kind: "hold", reason: "passive baseline — never trades, relies on the fee rebate" };
  },
};
