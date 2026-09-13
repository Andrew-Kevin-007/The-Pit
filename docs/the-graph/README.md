# The Graph — reference & integration map

Everything The-Graph in this repo, and the exact docs it's built from.

## What we ship

| Piece | Package | Track |
|---|---|---|
| Custom match-events subgraph | `packages/subgraph-match` | load-bearing for both |
| Messari Standardized DEX AMM subgraph (v3) | `packages/subgraph-messari` | **Track 1** — Composable / Standardized |
| Composed cross-subgraph query | `packages/graph-client/src/composed.ts` | **Track 1** |
| Subgraph MCP → agent reasoning loop | `packages/agent` + `.mcp.json` | **Track 2** — AI Use Case (From Scratch) |
| Reusable `SKILL.md` | `packages/agent/SKILL.md` | **Track 2** |
| x402 pay-per-query (stretch) | `packages/agent/src/x402.ts` | **Track 2** |

## Two Graph products, composed (Track 1 requirement)

1. **Standardized schema** — `subgraph-messari` uses the Messari DEX AMM
   (Extended) schema unmodified; `graph-client/src/messariSubgraph.ts` queries
   only standard fields, so it runs against any Messari DEX AMM subgraph.
2. **Composition** — `buildRoundContext()` joins `subgraph-match` (match/round/
   agent) with `subgraph-messari` (pool swaps/liquidity/tick) on `PoolId`.
3. **Second composition** — the Subgraph MCP layered over *both* deployments for
   cross-subgraph natural-language analysis.

**Standards leverage, stated for judges:** the market-analysis half of
`buildRoundContext` touches only generic Messari entities. Repoint
`MESSARI_SUBGRAPH_URL` at any other Messari DEX AMM subgraph and the same agent
reasoning runs against a different protocol — no code change.

## Live data only

Every path in the submitted build hits a **Subgraph Studio Development Query
URL** with an API key. Mock/local/static data disqualifies both tracks — see the
audit list in [`../SUBMISSION.md`](../SUBMISSION.md).

## Subgraph MCP

Config: repo-root `.mcp.json` and `packages/agent/mcp.json`.

```
endpoint : https://subgraphs.mcp.thegraph.com/sse
auth     : Authorization: Bearer <GRAPH_GATEWAY_API_KEY>   (Subgraph Studio key)
transport: npx mcp-remote (SSE)
tools    : schema by deployment/subgraph/IPFS id · execute query · keyword search ·
           discovery by contract address · 30-day query counts · NL query
```

## Vendored SKILLs

`.claude/skills/subgraph-dev`, `subgraph-optimization`, `subgraph-testing` —
from The Graph's official Subgraph SKILLs (MIT). See `.claude/skills/NOTICE.md`.
Canonical install: `claude plugins add PaulieB14/subgraphs-skills`.

## Source docs

- Subgraph MCP — https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/introduction/
- MCP + Claude config — https://thegraph.com/docs/en/subgraphs/tooling/subgraph-mcp/claude/
- Subgraph SKILLs — https://github.com/graphprotocol/subgraphs-skills
- Base Sepolia cookbook — https://thegraph.com/docs/en/cookbook/base-testnet/ (`network: base-sepolia`)
- Manifest / specVersion 1.3.0 — https://thegraph.com/docs/en/subgraphs/developing/creating/subgraph-manifest/
- Messari Standardized Subgraphs — https://thegraph.com/docs/en/subgraphs/existing-subgraphs/standard-subgraphs/
- Messari schema — https://github.com/messari/subgraphs/blob/master/schema-dex-amm.graphql
- Composition — https://thegraph.com/docs/en/subgraphs/guides/subgraph-composition/
- x402 with The Graph — track description ("pay per query autonomously with x402")

## Deploy order

1. Amalraj deploys `MatchController` + `PitRouter` → fill both `networks.json` + `.env`
2. `subgraph-match`: codegen → build → `graph auth` → deploy → sync → hand URL+key to Suganthan
3. `subgraph-messari`: set pool-init `startBlock` → codegen → build → deploy → sync
4. `graph-client`: set `MATCH_SUBGRAPH_URL`, `MESSARI_SUBGRAPH_URL`, `GRAPH_API_KEY` → build
5. `agent`: set deployment ids + `GRAPH_GATEWAY_API_KEY` → wire `narrate`
