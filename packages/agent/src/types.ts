import type { RoundContext } from "@the-pit/graph-client";
import type { RoundIndex } from "@the-pit/shared";

export interface TickInput {
  matchId: string;
  agent: string; // this agent's wallet
  poolId: string;
  round: RoundIndex;
  roundStartUnix: number;
  /** trades already made this round (client-side count) */
  tradesThisRound: number;
  maxTradesPerRound: number;
}

export type Action =
  | { kind: "hold"; reason: string }
  | { kind: "swap"; zeroForOne: boolean; sizePct: number; reason: string };

export interface Decision {
  action: Action;
  /** the full query -> reasoning -> decision chain; logged, and it is what the
   *  AI-track judges. Never empty. */
  chain: ReasoningStep[];
  /** one sanitized public line for the board */
  commentary: string;
  /** tx hash of the real on-chain swap this decision triggered, if any */
  txHash?: string;
}

export interface ReasoningStep {
  at: string; // ISO
  kind: "query" | "reason" | "decide";
  detail: string;
  data?: unknown;
}

export interface Strategy {
  id: string;
  /** pure decision from the composed context + opponent view + own limits */
  decide(input: TickInput, ctx: RoundContext, opp: OpponentView): Action;
}

/** What the agent is allowed to know about opponents mid-match. */
export interface OpponentView {
  /** coarse bucket only, and only from balances >= LEADER_DELAY_SECONDS old */
  lead: "EVEN" | "SLIGHT_EDGE" | "EDGE" | "STRONG_EDGE" | "UNKNOWN";
  /** true if THIS agent is the one ahead */
  selfAhead: boolean;
}
