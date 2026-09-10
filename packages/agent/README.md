# @the-pit/agent

Claude Agent SDK tick loop + **Subgraph-MCP reasoning**. Graph Track 2 (From Scratch).

- **Sylesh:** `tickLoop.ts`, `strategies/*`, swap execution, timing, commit-reveal client.
- **Suganthan:** `graphReasoning.ts` (query→reason→decide chain), `opponentView.ts` (fairness enforcement), `x402.ts`, MCP wiring.

## The pattern

Before each round the agent queries **its own on-chain track record** and the
**pool's live market state** — composed across both subgraphs
(`@the-pit/graph-client` `buildRoundContext`) — reasons over it, and the
reasoning changes the action. The full chain is logged; that log is what the
AI track judges. See [`SKILL.md`](./SKILL.md) for the reusable write-up.

## Files

| File | |
|---|---|
| `src/graphReasoning.ts` | `reason()` — QUERY (composed) → REASON (LLM `narrate` hook or rule-based) → DECIDE (strategy, bounded by trade cap + opponent view) |
| `src/opponentView.ts` | mid-match: coarse 4-way lead bucket from balances ≥ 20s old, nothing exact |
| `src/tickLoop.ts` | `runRound` / `runMatchLoop` — execution loop |
| `src/strategies/` | `momentum`, `mean-reversion`, `passive-hodl` (the deliberately-different 3rd) |
| `src/x402.ts` | optional pay-per-query wrapper + spend meter |
| `mcp.json` | Subgraph MCP config for the Agent SDK (points at both deployment ids) |

## Build

```bash
npm install && npm run build
```

## Wire-up checklist (Phase 4)

- [ ] `GRAPH_GATEWAY_API_KEY`, `MATCH_SUBGRAPH_DEPLOYMENT_ID`, `MESSARI_SUBGRAPH_DEPLOYMENT_ID` in env
- [ ] Pass a real `narrate` (LLM via Agent SDK with the MCP attached) into `reason()`
- [ ] Sylesh: implement `LoopConfig.execute` against the frozen swap call path
- [ ] Log every `Decision.chain` to a file the demo + judges can read
- [ ] x402: set `AGENT_X402_PRIVATE_KEY`, implement `signPayment`
