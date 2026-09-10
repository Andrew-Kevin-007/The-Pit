# @the-pit/runner

Match lifecycle orchestrator. Owner: Suganthan. Phases 1, 2, 5.

```
fund → register (commit) → start → [6 × (round window, lockRound)] → reveal → settle
```

## Commands

```bash
npm run build

# Phase 1 — no chain, no agent: publish + step the mock match to Supabase
npm run mock

# Phase 5 — full 3-agent rehearsal (mock)
npm run rehearse
# ...on chain once contracts + subgraph are live:
node --env-file=../../.env dist/index.js rehearse --chain

# Phase 2+ — one real match
npm run run:match
```

## Modes

| | `mock` | `chain` |
|---|---|---|
| contract calls | logged only | real viem writes to `MatchController` |
| round-lock balances | synthesized drift | `USDC.balanceOf()` read on-chain |
| subgraph assertions | skipped | `waitForSettlement` + 6-round check |

## Files

| File | Role |
|---|---|
| `src/stateModel` (from `@the-pit/shared`) | the lifecycle shape everything aligns to |
| `src/lifecycle.ts` | `runMatch()` — the state machine, both modes |
| `src/chain.ts` / `src/abis.ts` | viem clients, on-chain USDC read, MatchController ABI (Day-1 proposal) |
| `src/board.ts` | single writer of `board_state` in Supabase |
| `src/mockDriver.ts` | Phase 1 mock match stepper |
| `src/rehearsal.ts` | Phase 5 — 3 agents, identical pipeline, asserts both subgraphs |

## Phase 2 wiring (after Amalraj deploys)

1. Fill `.env`: `RUNNER_PRIVATE_KEY`, `MATCH_CONTROLLER_ADDRESS`, `PIT_ROUTER_ADDRESS`, `USDC_ADDRESS`, `POOL_ADDRESS`.
2. Replace the function fragments in `src/abis.ts` with his real `MatchController` ABI.
3. Set `MATCH_SUBGRAPH_URL` + `GRAPH_API_KEY` so `rehearse --chain` can assert the record.
