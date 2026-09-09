/**
 * Strategy config JSON shape (Phase 0 — Sylesh defines, Amalraj hashes it).
 *
 * The agent commits keccak256(utf8(canonicalConfigString(cfg)) || salt) before
 * the match and reveals the plaintext after. `canonicalConfigString` must be
 * byte-identical on both sides: keys sorted recursively, no insignificant
 * whitespace.
 */
export interface StrategyConfig {
  /** strategy id — must resolve in @the-pit/agent/strategies */
  strategy: string;
  /** version of the strategy code */
  version: string;
  /** free-form knobs the strategy reads; JSON scalars only */
  params: Record<string, number | string | boolean>;
  /** max trades the agent intends per round (must be <= on-chain cap) */
  maxTradesPerRound: number;
  /** whether the agent will consult its Graph history before deciding */
  usesGraphHistory: boolean;
}

/** Deterministic JSON: object keys sorted recursively, no extra whitespace. */
export function canonicalConfigString(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalConfigString).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const body = Object.keys(obj)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalConfigString(obj[k])}`)
      .join(",");
    return `{${body}}`;
  }
  return JSON.stringify(value) ?? "null";
}
