/**
 * Queries against @the-pit/subgraph-messari.
 *
 * Every field below is part of the Messari Standardized DEX AMM schema. Point
 * MESSARI_SUBGRAPH_URL at any other Messari DEX AMM subgraph and these queries
 * run unchanged — nothing here is Uniswap-specific.
 */
import { GraphQLClient, gql } from "graphql-request";
import { authHeaders, loadConfig, retryable, type GraphConfig } from "./config.js";

function client(cfg: GraphConfig): GraphQLClient {
  return new GraphQLClient(cfg.messariUrl, { headers: authHeaders(cfg) });
}

export interface StdSwap {
  hash: string;
  timestamp: string;
  from: string;
  to: string;
  tokenIn: { id: string; symbol: string; decimals: number };
  amountIn: string;
  tokenOut: { id: string; symbol: string; decimals: number };
  amountOut: string;
  tick: string | null;
}

export interface StdPool {
  id: string;
  name: string | null;
  activeLiquidity: string;
  tick: string | null;
  cumulativeSwapCount: number;
  cumulativeVolumeByTokenAmount: string[];
  fees: { feeType: string; feePercentage: string | null }[];
}

export interface PoolActivity {
  liquidityPool: StdPool | null;
  swaps: StdSwap[];
}

const POOL_ACTIVITY = gql`
  query PoolActivity($pool: ID!, $poolBytes: Bytes!, $since: BigInt!, $first: Int!) {
    liquidityPool(id: $pool) {
      id
      name
      activeLiquidity
      tick
      cumulativeSwapCount
      cumulativeVolumeByTokenAmount
      fees {
        feeType
        feePercentage
      }
    }
    swaps(
      where: { pool: $poolBytes, timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      hash
      timestamp
      from
      to
      tokenIn {
        id
        symbol
        decimals
      }
      amountIn
      tokenOut {
        id
        symbol
        decimals
      }
      amountOut
      tick
    }
  }
`;

export async function getPoolActivity(
  poolId: string,
  sinceUnix: number,
  first = 100,
  cfg = loadConfig(),
): Promise<PoolActivity> {
  return retryable(
    () =>
      client(cfg).request<PoolActivity>(POOL_ACTIVITY, {
        pool: poolId,
        poolBytes: poolId,
        since: String(sinceUnix),
        first,
      }),
    { label: "PoolActivity" },
  );
}
