/**
 * THE MATCH STATE MODEL  (Phase 0 deliverable — Suganthan owns this)
 *
 * One format: fixed $1 USDC stake, six fixed 50-second rounds (5 min total),
 * house-seeded liquidity. The loop, the board, the runner, and both
 * subgraphs all align to the shapes and transitions defined here. Do not
 * fork this per package.
 */

export const ROUND_COUNT = 6;
export const ROUND_SECONDS = 50; // must match backend/src/MatchController.sol ROUND_SECONDS
export const STAKE_USDC = 1_000_000n; // 1 * 1e6, USDC has 6 decimals — must match backend/src/MatchController.sol STAKE_USDC
export const MATCH_SECONDS = ROUND_COUNT * ROUND_SECONDS; // 300s (5 min)

/** Round index is 0..5 inclusive. */
export type RoundIndex = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Match lifecycle. Transitions are one-way, top to bottom:
 *
 *   REGISTERING  agents fund + register + commit hashed strategy config
 *        │  MatchStarted
 *   LIVE         6 rounds run; agents trade through the hook-gated pool
 *        │  RoundLocked (x6) — last one flips to LOCKED
 *   LOCKED       clock done; on-chain USDC balances are the score of record
 *        │  StrategyRevealed (per agent)
 *   REVEALED     configs + trade logs public
 *        │  MatchSettled — winner + fee rebates distributed
 *   SETTLED      terminal; the subgraph record is the permanent proof
 */
export type MatchStatus =
  | "REGISTERING"
  | "LIVE"
  | "LOCKED"
  | "REVEALED"
  | "SETTLED";

export const STATUS_ORDER: MatchStatus[] = [
  "REGISTERING",
  "LIVE",
  "LOCKED",
  "REVEALED",
  "SETTLED",
];

export function canTransition(from: MatchStatus, to: MatchStatus): boolean {
  const i = STATUS_ORDER.indexOf(from);
  const j = STATUS_ORDER.indexOf(to);
  return j === i + 1;
}

/** Contract event → the status it drives the match into (or null if it doesn't). */
export const EVENT_TO_STATUS: Record<string, MatchStatus | null> = {
  AgentRegistered: "REGISTERING",
  MatchStarted: "LIVE",
  AgentSwap: null, // trade log, no status change
  RoundLocked: "LOCKED", // idempotent; only the final round's lock matters for status
  StrategyRevealed: "REVEALED",
  MatchSettled: "SETTLED",
  PickSubmitted: null,
};

export interface AgentRef {
  /** backend-managed wallet address, lowercased */
  wallet: string;
  /** display handle for the board */
  handle: string;
  /** strategy id (see @the-pit/agent/strategies) */
  strategy: string;
}

export interface RoundState {
  index: RoundIndex;
  /** unix seconds when this round's clock started */
  startedAt: number | null;
  /** unix seconds when RoundLocked fired */
  lockedAt: number | null;
  /** wallet -> USDC balance (string, base units) read on-chain at lock */
  balances: Record<string, string>;
  /** wallet -> count of trades this round */
  trades: Record<string, number>;
  /** wallet -> sanitized one-line commentary */
  commentary: Record<string, string>;
  /** wallet -> tx hashes of that round's real on-chain swaps, for Etherscan links */
  txHashes: Record<string, string[]>;
}

export interface AgentResult {
  wallet: string;
  finalUsdc: string;
  pnl: string; // finalUsdc - STAKE_USDC
  rebate: string;
  won: boolean;
}

export interface MatchState {
  /** decimal string, matches Match.id in the subgraph */
  matchId: string;
  status: MatchStatus;
  /** v4 PoolId (bytes32 hex) the match trades on */
  poolId: string | null;
  createdAt: number;
  startTime: number | null;
  settledAt: number | null;
  agents: AgentRef[];
  currentRound: RoundIndex | null;
  rounds: RoundState[];
  results: AgentResult[];
  winner: string | null;
}

export function emptyRounds(): RoundState[] {
  return Array.from({ length: ROUND_COUNT }, (_, i) => ({
    index: i as RoundIndex,
    startedAt: null,
    lockedAt: null,
    balances: {},
    trades: {},
    commentary: {},
    txHashes: {},
  }));
}

export function newMatchState(matchId: string, agents: AgentRef[]): MatchState {
  return {
    matchId,
    status: "REGISTERING",
    poolId: null,
    createdAt: Math.floor(Date.now() / 1000),
    startTime: null,
    settledAt: null,
    agents,
    currentRound: null,
    rounds: emptyRounds(),
    results: [],
    winner: null,
  };
}

/** Seconds remaining in the round / match given a start time. Clamped at 0. */
export function secondsLeft(startTime: number, now = Date.now() / 1000): {
  round: RoundIndex | null;
  roundRemaining: number;
  matchRemaining: number;
} {
  const elapsed = Math.max(0, now - startTime);
  const matchRemaining = Math.max(0, MATCH_SECONDS - elapsed);
  if (matchRemaining === 0) return { round: null, roundRemaining: 0, matchRemaining: 0 };
  const round = Math.min(ROUND_COUNT - 1, Math.floor(elapsed / ROUND_SECONDS)) as RoundIndex;
  const roundRemaining = ROUND_SECONDS - (elapsed % ROUND_SECONDS);
  return { round, roundRemaining, matchRemaining };
}
