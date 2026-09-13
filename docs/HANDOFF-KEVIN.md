# Handoff: Suganthan → Kevin

**TL;DR** — The whole Graph pipeline is scaffolded, both subgraphs are deployed to
Subgraph Studio, and everything that consumes them (`graph-client`, the agent's
reasoning loop, the runner, the board) is wired and verified against the live
endpoints. Your job now: take over **`subgraph-match`** (the custom match-events
subgraph — already deployed as a placeholder), swap in Amalraj's real ABIs +
addresses, and redeploy. Don't rename the entities/fields listed in §4 — my code
queries them by name.

---

## 1. What I've done

### Deployed (live on Subgraph Studio, account org `0x588F…EbECdc`)

| Subgraph | Slug | Version | State |
|---|---|---|---|
| **`subgraph-match`** (yours) | `pit` | v0.0.5 | live, synced, pointed at the **current real deployed contracts** (see below), `startBlock` 46,732,626. Empty — no match run against *this* deploy yet (a prior deploy's match is still queryable, see note below). |
| **`subgraph-messari`** (mine, Track 1) | `pit-messari` | v0.0.3 | live, synced, **indexing real v3 data** — 1 pool (the same real house pool below), 400+ swaps and growing, real deposits with real token amounts |

- `pit` dashboard: https://thegraph.com/studio/subgraph/pit
- `pit` query URL: `https://api.studio.thegraph.com/query/1758823/pit/v0.0.5`
- `pit` deployment ID: `QmZjwjBXUZmiuookzAd3KLafa3cHEVqTQ2rMQxDdqzR5Md`
- `pit-messari` query URL: `https://api.studio.thegraph.com/query/1758823/pit-messari/v0.0.3`
- `pit-messari` deployment ID: `Qma7MveViTLnvDzQQoLVq58XKDwMJb1WBarKGiNtQF9kTE`
- All of the above + the API key + deploy key are in the local **`.env`** (gitignored — I'll send it to you separately).

### Real deployed contracts (Base Sepolia, block 46,732,626 — current)

Broadcast this session — see `DELIVERABLES.md` "Update (Suganthan)" /
"Update 3" for the full story (stake dropped to $1, a real `deadline` bug
found + fixed in `Deploy.s.sol`, then `ROUND_SECONDS` dropped 90s → 50s so
the match is 5 min instead of 9 — a fresh deploy, since it's a `constant`
baked into bytecode).

| Contract | Address |
|---|---|
| `MatchController` | `0xF6970a7cFa2E0B81357d5d2D2Ab10Cb7330fE944` |
| `PitRouter` | `0x11231A06FA6673b0C22361670F711DCaf12Fc01c` |
| `CommitReveal` | `0x0e156435094289B4034a0E813ce2800F13540055` |
| House pool (`POOL_ADDRESS`) | `0x46880b404CD35c165EDdefF7421019F8dD25F4Ad` — real USDC/WETH 0.3%, same one `subgraph-messari` already indexes, unchanged across both deploys |

Superseded deploy (block 46,691,889, `MatchController` `0x5227...0E812`) ran a
full live 3-agent rehearsal to completion (`Match#1` `SETTLED`) before the
round-length change — that record is still queryable in `pit`, just at that
older address/version, not the current one.

### Code (all builds, typechecks, `graph build` clean)

| Package | What | Status |
|---|---|---|
| `packages/subgraph-match` | **your artifact** — schema, manifest (2 data sources), mappings for register/start/lock/reveal/settle/pick + PitRouter's `AgentSwap`. ABIs verified byte-for-byte against the real deployed `MatchController.sol`/`PitRouter.sol` source, `networks.json` now has the real addresses. `Match.poolId` stamped in `handleMatchStarted` from the real pool address. | **deployed against real contracts**, still empty (no match run yet) |
| `packages/subgraph-messari` | Messari Standardized DEX AMM (Extended) schema, mapped from a single Uniswap v3 pool contract directly (v3 has no singleton — every pool is its own contract). Lazily creates the `LiquidityPool` on the first event it sees for a pool (Swap/Mint/Burn, not just `Initialize`) — real pools are almost always initialized before this subgraph's `startBlock`, so requiring `Initialize` first would silently drop everything after. | done, live, real data |
| `packages/graph-client` | typed queries over **both** subgraphs + the composed `buildRoundContext()` (join on `poolId`) | done, verified live |
| `packages/agent` | Subgraph-MCP reasoning loop (query→reason→decide, logged), coarse+delayed opponent-view enforcement, 3 strategies, x402 wrapper, `SKILL.md` | done (LLM `narrate` + x402 signer still stubs) |
| `packages/runner` | match lifecycle orchestrator — mock mode runs the full lifecycle; chain mode wired for viem writes + on-chain USDC read; 3-agent rehearsal harness | done (funding `USDC.transfer` step still to add) |
| `packages/web` | Next.js board — countdown, coarse+delayed leader, commentary, spectator picks | done (needs a Supabase project) |
| `packages/shared` | the match state model, leader rule, strategy-config hash, mock fixture | done |
| `.mcp.json`, `packages/agent/mcp.json` | Subgraph MCP server config | done |
| `.claude/skills/` | vendored Graph Subgraph SKILLs (dev/optimization/testing) | done |
| `docs/` | `STATE-MODEL`, `INTERFACE-FREEZE`, `BUILD`, `DEMO-SCRIPT`, `SUBMISSION`, `the-graph/README` | done |

---

## 2. What you take from me

1. **The deployed `pit` subgraph.** Iterate *this* one — don't make a new slug, so
   the query URL and deployment ID stay predictable. You need deploy rights:
   either I share `GRAPH_DEPLOY_KEY` (in `.env`) with you, or you add me to run
   deploys. For the hackathon, take the key.
2. **`packages/subgraph-match/`** — your working tree. Manifest, schema, mappings,
   placeholder ABIs, `networks.json`, `README.md`.
3. **The frozen event signatures** — `docs/INTERFACE-FREEZE.md` §1 and the
   placeholder `abis/*.json`. These are the Day-1 proposal; confirm them with
   Amalraj, adjust both the ABI JSON and the manifest `eventHandlers` if they change.
4. **The state model** — `packages/shared/src/stateModel.ts` +
   `docs/STATE-MODEL.md`. `Match.status` uses the string enum
   `REGISTERING | LIVE | LOCKED | REVEALED | SETTLED` — my `waitForSettlement`
   polls for the literal `"SETTLED"`.

---

## 3. What you do (checklist)

```bash
cd packages/subgraph-match
npm install
```

- [x] Get Amalraj's **real ABIs** → replaced `abis/MatchController.json` and `abis/PitRouter.json` (renamed from `PitHook.json` — v3 has no hook; `backend/src/PitRouter.sol` emits `AgentSwap` from its swap callback instead. Event names/params kept identical to §4.)
- [x] Get his **deployed addresses + deploy blocks** → `networks.json` now has the real ones: `MatchController` `0x5227...0E812`, `PitRouter` `0x9476...cB3f`, `startBlock` 46,691,889 (Base Sepolia, broadcast this session — see `DELIVERABLES.md`)
- [x] Confirmed: `PitRouter.swap()` emits `AgentSwap` directly (no `_afterSwap` — that was v4-hook language; v3's router has no callback stage to hook into, it just emits after forwarding to `pool.swap()`). `MatchSettled.rebateAmounts[]` is in agent-registration order — `MatchController.settle()` builds it by iterating `participants[]` in that order.
- [x] `npm run codegen && npm run build` — verified clean against the real `graph-cli`
- [x] `npm run test` — Matchstick tests written under `tests/` for every handler
  (`tests/match-controller.test.ts`, `tests/pit-router.test.ts`, `tests/helpers.ts`).
  Compile-verified (`asc --noEmit` against the real graph-ts/matchstick-as, exit
  0) but **not runtime-verified** — no Windows Matchstick binary, Docker Desktop
  wasn't running here. Run `npm run test:docker` (start Docker Desktop first) or
  `npm test` on Linux/macOS to get the actual pass/fail before you trust them.
- [x] `pit` is deployed at `v0.0.4` against the real addresses above — synced,
  `hasIndexingErrors: false`. If you touch the mappings/schema again, deploy
  your next version as `v0.0.5` (`--version-label v0.0.5`; the `deploy` script
  already does `graph build --network base-sepolia` first)
- [x] Run a rehearsal match and confirm real rows appear — **done.** 3 real,
  individually-funded, individually-signing wallets ran the full lifecycle
  for real: register → approve → start → 6 real 90s on-chain rounds with real
  `PitRouter.swap()`s → lock → reveal → settle. `Match#1` in `pit` v0.0.4:
  `SETTLED`, correct winner, all 6 rounds with real balances, 16 real
  `Trade`s with real fee data, all 3 `StrategyReveal`s. Confirms your
  mappings are correct against the real contracts, not just the placeholder
  ABIs. (Ran as a standalone script, not through `packages/runner`'s
  `rehearse('chain')` — that still needs real per-agent signing wired in;
  see `DELIVERABLES.md` "What's left" #5.)

---

## 4. Contract — do NOT rename these (my code queries them by name)

`graph-client/src/matchSubgraph.ts` and `agent/src/opponentView.ts` run these
exact selections. If you change a field name or type, tell me and I'll update the
queries.

```graphql
# getAgentHistory
agentResults(where: { agent: Bytes }, orderBy: match__createdAt, orderDirection: desc, first: Int) {
  finalUsdc  pnl  rebate  won
  match { id  status  createdAt }
}

# getAgentTrades
trades(where: { agent: Bytes, match: String }, orderBy: timestamp) {
  roundIndex  amount0  amount1  feeAccrued  timestamp
}

# getMatchBoard  (also used by the agent's opponent-view)
match(id: ID) {
  id  status  poolId
  participants { id }
  rounds(orderBy: roundIndex) {
    roundIndex  lockedAt
    locks { agent { id }  usdcBalance }
  }
}

# waitForSettlement
match(id: ID) {
  status              # must reach the literal "SETTLED"
  settledAt
  winner { id }
  results { agent { id }  finalUsdc  pnl  rebate  won }
}
```

Entities/fields that must keep their names + meaning:
`Agent.id` · `Match{id,status,poolId,participants,createdAt,settledAt,winner,rounds,results}` ·
`Round{roundIndex,lockedAt,locks}` · `RoundLock{agent,usdcBalance}` ·
`AgentResult{agent,match,finalUsdc,pnl,rebate,won}` ·
`Trade{agent,match,roundIndex,amount0,amount1,feeAccrued,timestamp}`

---

## 5. What you hand back to me

After each redeploy:

- [ ] The new **Development Query URL** (`.../pit/v0.0.X`) → I put it in `.env` as `MATCH_SUBGRAPH_URL`
- [ ] The new **deployment ID** (`Qm…`) → `.env` `MATCH_SUBGRAPH_DEPLOYMENT_ID` (for the agent's MCP config)
- [ ] The final **`schema.graphql`** if any entity/field in §4 changed
- [ ] Confirmation of the two assumptions in §3 (`AgentSwap` exists; `rebateAmounts` ordering)

Then I re-point `graph-client`, the agent, and the runner, and we run the full
`rehearse --chain` end-to-end.

---

## 6. Notes

- The `pit` manifest currently has `startBlock: 46624000` just so the placeholder
  syncs fast. Set it to the **actual contract deploy block** in `networks.json`
  when you have it, or it'll miss early events.
- `pit-messari` is already the "live data" proof for Track 1 — you don't touch it.
- Composition (Track 1) is `graph-client/src/composed.ts` `buildRoundContext()` —
  it joins your `Match/AgentResult` with the Messari `LiquidityPool/Swap` on
  `poolId`. **Done as of `pit` v0.0.3:** `Match.poolId` is stamped in
  `handleMatchStarted` from `helpers.POOL_ADDRESS` — a manifest-level `Bytes`
  constant, since no event carries a pool address (Phase 1 is one fixed house
  pool, and PitRouter's `pool` is an immutable constructor arg, not something
  it ever emits). Zero bytes until Amalraj deploys PitRouter; update
  `POOL_ADDRESS` in `packages/subgraph-match/src/helpers.ts` once it exists,
  then redeploy — and point `packages/subgraph-messari/networks.json` at the
  same address so both subgraphs agree on which pool is "the" pool.
