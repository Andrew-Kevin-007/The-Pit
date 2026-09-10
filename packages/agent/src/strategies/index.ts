import type { Strategy } from "../types.js";
import { momentum } from "./momentum.js";
import { meanReversion } from "./meanReversion.js";
import { passiveHodl } from "./passiveHodl.js";

const REGISTRY: Record<string, Strategy> = {
  [momentum.id]: momentum,
  [meanReversion.id]: meanReversion,
  [passiveHodl.id]: passiveHodl,
};

export function getStrategy(id: string): Strategy {
  const s = REGISTRY[id];
  if (!s) throw new Error(`unknown strategy: ${id}`);
  return s;
}

export const STRATEGY_IDS = Object.keys(REGISTRY);
export { momentum, meanReversion, passiveHodl };
