---
name: track-record-aware-trading
description: Use when an autonomous trading agent should consult its own verifiable on-chain track record (past results, per-round trades, realized PnL) and live pool state through The Graph's Subgraph MCP before it decides its next move — so the decision is informed by history, not just the current tick.
version: 0.1.0
---

# Track-record-aware trading agent

A reusable pattern: before acting, an agent **queries its own past performance
and the market's live state through the Subgraph MCP**, reasons over both, and
lets that reasoning change the action. The reasoning chain is logged and is the
artifact of record — not the raw query result.

This is infrastructure, not one app: any trading/execution agent that has ever
written results to a subgraph can adopt it. The Pit is the reference consumer.

## When to use

- The agent has a queryable history (a results subgraph, a positions subgraph, or
  a standardized Messari DEX AMM subgraph for the venue it trades).
- You want "reasoning, decisions, automation" on live Graph data, not a raw dump.

## Setup — Subgraph MCP

Add the server to the Claude Agent SDK config (`mcpServers`). Same as repo root
`.mcp.json`:

```json
{
  "mcpServers": {
    "subgraph": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "--header", "Authorization:${AUTH_HEADER}", "https://subgraphs.mcp.thegraph.com/sse"],
      "env": { "AUTH_HEADER": "Bearer ${GRAPH_GATEWAY_API_KEY}" }
    }
  }
}
```

`GRAPH_GATEWAY_API_KEY` comes from Subgraph Studio. The server exposes:
schema retrieval by deployment/subgraph/IPFS id, query execution, keyword +
contract-address discovery, and 30-day query counts.

## The loop (per decision)

1. **QUERY — own record.** Through the MCP, run against your results subgraph:

   ```graphql
   query MyHistory($agent: Bytes!) {
     agentResults(where: { agent: $agent }, orderBy: match__createdAt, orderDirection: desc, first: 25) {
       won  pnl  rebate  finalUsdc
       match { id status }
     }
   }
   ```

   and your per-round trades for the current match (`trades(where: {agent, match})`).

2. **QUERY — market.** Against a **Messari Standardized DEX AMM** subgraph for the
   venue (standard shape → same query works for any such venue):

   ```graphql
   query PoolState($pool: ID!, $poolBytes: Bytes!, $since: BigInt!) {
     liquidityPool(id: $pool) { activeLiquidity tick cumulativeSwapCount }
     swaps(where: { pool: $poolBytes, timestamp_gte: $since }, orderBy: timestamp, orderDirection: desc, first: 100) {
       tokenIn { symbol } amountIn tokenOut { symbol } amountOut tick
     }
   }
   ```

3. **REASON — in plain language, and make it consequential.** e.g.
   *"3 of my last 5 rounds lost while over-trading a thin book; recent pool flow
   is still thin (2 swaps/hour). Cut clip size to 15% and only act on a clean
   tick break."* If the reasoning doesn't change what you'd otherwise do, you're
   not doing this pattern.

4. **DECIDE.** Strategy picks the action, bounded by hard limits (trade cap,
   round window) and by a **coarse + delayed** opponent view only — never exact
   live opponent positions.

5. **LOG THE CHAIN.** `{ query → data → reasoning → decision }` per tick. This log
   is the deliverable.

## Fairness constraint (enforce in the query layer)

Mid-match, opponent data must be **bucketed and delayed** (see
`src/opponentView.ts`): a 4-way lead bucket from balances at least 20s old.
Exact numbers only after reveal. Don't rely on the strategy to be polite.

## Reference implementation

| File | Role |
|---|---|
| `src/graphReasoning.ts` | the query→reason→decide chain (`reason()`), with an LLM `narrate` hook and a deterministic fallback |
| `src/opponentView.ts` | coarse+delayed opponent enforcement |
| `src/tickLoop.ts` | per-round execution loop calling `reason()` |
| `@the-pit/graph-client` `composed.ts` | `buildRoundContext()` — the two-subgraph join |
| `src/x402.ts` | optional: pay-per-query via x402 with a spend meter |

## x402 (optional, rewarded)

Wrap the paid gateway fetch: on `402`, sign a micropayment from the agent's own
wallet, retry with `X-PAYMENT`, meter the spend. See `src/x402.ts` and the
`okx-agent-payments-protocol` skill.
