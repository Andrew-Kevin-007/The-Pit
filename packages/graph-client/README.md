# @the-pit/graph-client

Typed query layer over **both** subgraphs, plus the **composed cross-subgraph
query** that is the Graph Track 1 deliverable. Owner: Suganthan.

## Modules

| File | Purpose | Used by |
|---|---|---|
| `config.ts` | Endpoints + `Authorization` header from env | all |
| `matchSubgraph.ts` | `getAgentHistory`, `getAgentTrades`, `getMatchBoard`, `waitForSettlement` | agent, board, runner |
| `messariSubgraph.ts` | `getPoolActivity` — pure Messari-standard shape | agent, board |
| `composed.ts` | `buildRoundContext` — joins both subgraphs on `poolId` | agent reasoning loop, board |

## Env

```
MATCH_SUBGRAPH_URL=<Studio Development Query URL for @the-pit/subgraph-match>
MESSARI_SUBGRAPH_URL=<Studio Development Query URL for @the-pit/subgraph-messari-v4>
GRAPH_API_KEY=<Subgraph Studio API key>
```

## Build

```bash
npm install
npm run typecheck
npm run build     # -> dist/
```

## The composition, in one place

`buildRoundContext(agent, poolId, roundStartUnix)`:

1. `getAgentHistory` → prior match results, win rate, PnL trend  *(custom subgraph)*
2. `getPoolActivity` → recent swaps, liquidity, current tick  *(Messari standard subgraph)*
3. returns one `RoundContext` object the agent reasons over before acting

The market half only touches standardized entities, so pointing
`MESSARI_SUBGRAPH_URL` at any other Messari DEX AMM subgraph makes the same
function work against a different protocol — state this explicitly in the demo.
