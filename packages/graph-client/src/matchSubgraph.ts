/**
 * Queries against @the-pit/subgraph-match (Kevin's custom subgraph).
 */
import { GraphQLClient, gql } from "graphql-request";
import { authHeaders, loadConfig, type GraphConfig } from "./config.js";

function client(cfg: GraphConfig): GraphQLClient {
  return new GraphQLClient(cfg.matchUrl, { headers: authHeaders(cfg) });
}

// ---------- "my past matches" — feeds the agent reasoning loop ----------

export interface AgentResultRow {
  finalUsdc: string;
  pnl: string;
  rebate: string;
  won: boolean;
  match: { id: string; status: string; createdAt: string };
}

const AGENT_HISTORY = gql`
  query AgentHistory($agent: Bytes!, $first: Int!) {
    agentResults(
      where: { agent: $agent }
      orderBy: match__createdAt
      orderDirection: desc
      first: $first
    ) {
      finalUsdc
      pnl
      rebate
      won
      match {
        id
        status
        createdAt
      }
    }
  }
`;

export async function getAgentHistory(
  agent: string,
  first = 25,
  cfg = loadConfig(),
): Promise<AgentResultRow[]> {
  const data = await client(cfg).request<{ agentResults: AgentResultRow[] }>(
    AGENT_HISTORY,
    { agent: agent.toLowerCase(), first },
  );
  return data.agentResults;
}

export interface AgentTradeRow {
  roundIndex: number;
  amount0: string;
  amount1: string;
  feeAccrued: string;
  timestamp: string;
}

const AGENT_TRADES = gql`
  query AgentTrades($agent: Bytes!, $match: String!) {
    trades(
      where: { agent: $agent, match: $match }
      orderBy: timestamp
      orderDirection: asc
      first: 100
    ) {
      roundIndex
      amount0
      amount1
      feeAccrued
      timestamp
    }
  }
`;

export async function getAgentTrades(
  agent: string,
  matchId: string,
  cfg = loadConfig(),
): Promise<AgentTradeRow[]> {
  const data = await client(cfg).request<{ trades: AgentTradeRow[] }>(
    AGENT_TRADES,
    { agent: agent.toLowerCase(), match: matchId },
  );
  return data.trades;
}

// ---------- board view (coarse leader is derived by the caller) ----------

export interface MatchBoard {
  id: string;
  status: string;
  poolId: string | null;
  participants: { id: string }[];
  winner: { id: string } | null;
  results: { agent: { id: string }; finalUsdc: string; pnl: string; rebate: string; won: boolean }[];
  rounds: {
    roundIndex: number;
    lockedAt: string | null;
    locks: { agent: { id: string }; usdcBalance: string }[];
  }[];
}

const MATCH_BOARD = gql`
  query MatchBoard($id: ID!) {
    match(id: $id) {
      id
      status
      poolId
      participants {
        id
      }
      winner {
        id
      }
      results {
        agent {
          id
        }
        finalUsdc
        pnl
        rebate
        won
      }
      rounds(orderBy: roundIndex) {
        roundIndex
        lockedAt
        locks {
          agent {
            id
          }
          usdcBalance
        }
      }
    }
  }
`;

export async function getMatchBoard(
  id: string,
  cfg = loadConfig(),
): Promise<MatchBoard | null> {
  const data = await client(cfg).request<{ match: MatchBoard | null }>(
    MATCH_BOARD,
    { id },
  );
  return data.match;
}

// ---------- runner: confirm the record is written before moving on ----------

const MATCH_SETTLED = gql`
  query MatchSettled($id: ID!) {
    match(id: $id) {
      id
      status
      settledAt
      winner {
        id
      }
      results {
        agent {
          id
        }
        finalUsdc
        pnl
        rebate
        won
      }
    }
  }
`;

// ---------- strategy reveals (commit-reveal payoff, per match) ----------

export interface MatchRevealRow {
  agent: { id: string };
  config: string;
  timestamp: string;
}

const MATCH_REVEALS = gql`
  query MatchReveals($match: String!) {
    strategyReveals(where: { match: $match }, first: 50) {
      agent {
        id
      }
      config
      timestamp
    }
  }
`;

export async function getMatchReveals(
  matchId: string,
  cfg = loadConfig(),
): Promise<MatchRevealRow[]> {
  const data = await client(cfg).request<{ strategyReveals: MatchRevealRow[] }>(
    MATCH_REVEALS,
    { match: matchId },
  );
  return data.strategyReveals;
}

// ---------- leaderboard (Hall of Records — aggregation over all agents) ----------

export interface LeaderboardAgentRow {
  id: string;
  firstSeen: string;
  totalMatches: number;
  wins: number;
  results: { pnl: string; rebate: string; won: boolean }[];
}

const LEADERBOARD = gql`
  query Leaderboard($first: Int!) {
    agents(orderBy: wins, orderDirection: desc, first: $first) {
      id
      firstSeen
      totalMatches
      wins
      results {
        pnl
        rebate
        won
      }
    }
  }
`;

export async function getLeaderboard(
  first = 200,
  cfg = loadConfig(),
): Promise<LeaderboardAgentRow[]> {
  const data = await client(cfg).request<{ agents: LeaderboardAgentRow[] }>(
    LEADERBOARD,
    { first },
  );
  return data.agents;
}

export interface GlobalStats {
  totalMatches: number;
  totalSettledMatches: number;
  totalAgents: number;
}

const GLOBAL_STATS = gql`
  query GlobalStats($first: Int!) {
    matches(first: $first) {
      id
      status
    }
    agents(first: $first) {
      id
    }
  }
`;

export async function getGlobalStats(
  first = 1000,
  cfg = loadConfig(),
): Promise<GlobalStats> {
  const data = await client(cfg).request<{
    matches: { id: string; status: string }[];
    agents: { id: string }[];
  }>(GLOBAL_STATS, { first });
  return {
    totalMatches: data.matches.length,
    totalSettledMatches: data.matches.filter((m) => m.status === "SETTLED").length,
    totalAgents: data.agents.length,
  };
}

// ---------- match history (browse every match ever run) ----------

export interface MatchSummary {
  id: string;
  status: string;
  createdAt: string;
  startTime: string | null;
  settledAt: string | null;
  winner: { id: string } | null;
  participants: { id: string }[];
}

const ALL_MATCHES = gql`
  query AllMatches($first: Int!) {
    matches(orderBy: createdAt, orderDirection: desc, first: $first) {
      id
      status
      createdAt
      startTime
      settledAt
      winner {
        id
      }
      participants {
        id
      }
    }
  }
`;

export async function getAllMatches(
  first = 50,
  cfg = loadConfig(),
): Promise<MatchSummary[]> {
  const data = await client(cfg).request<{ matches: MatchSummary[] }>(ALL_MATCHES, { first });
  return data.matches;
}

export async function waitForSettlement(
  id: string,
  opts: { tries?: number; delayMs?: number; cfg?: GraphConfig } = {},
): Promise<unknown> {
  const tries = opts.tries ?? 30;
  const delayMs = opts.delayMs ?? 2000;
  const cfg = opts.cfg ?? loadConfig();
  for (let i = 0; i < tries; i++) {
    const data = await client(cfg).request<{
      match: { status: string } | null;
    }>(MATCH_SETTLED, { id });
    if (data.match && data.match.status === "SETTLED") return data.match;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(
    `match ${id} did not reach SETTLED in the subgraph after ${tries} tries`,
  );
}
