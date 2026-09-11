# @the-pit/subgraph-match

Custom subgraph indexing The Pit's own contract events. **Owner: Kevin.**
See [`../../README-Kevin.md`](../../README-Kevin.md) for the full task list.

## Status

**Deployed against real contracts.** Studio slug `pit`, `v0.0.4` —
https://thegraph.com/studio/subgraph/pit — live, synced,
`hasIndexingErrors: false`, pointed at the real
`MatchController`/`PitRouter` on Base Sepolia (deploy block 46,691,889, see
`docs/HANDOFF-KEVIN.md`). Still empty — no match has been registered against
the real contracts yet, that's the only thing left before real rows appear.

## Layout

| File | What |
|---|---|
| `schema.graphql` | Entities: `Agent`, `Match`, `Round`, `Registration`, `RoundLock`, `Trade`, `StrategyReveal`, `AgentResult`, `Pick` |
| `subgraph.yaml` | Two data sources — `MatchController` and `PitRouter` — on `base-sepolia` |
| `networks.json` | Per-network address + startBlock (the values to edit after deploy) |
| `abis/*.json` | **Placeholder** event-only ABIs — replace with Amalraj's real ABIs |
| `src/match-controller.ts` | Handlers for registration, start, round lock, reveal, settle, pick |
| `src/pit-router.ts` | Handler for PitRouter's `AgentSwap` domain event → `Trade` |
| `src/helpers.ts` | ID builders, load-or-create, `STAKE` constant |

## Local workflow

```bash
npm install
npm run codegen        # generates ./generated from ABIs + schema
npm run build           # compiles AssemblyScript to wasm
npm test                # matchstick unit tests — native binary; Windows: use test:docker
npm run test:docker     # matchstick via Docker (`graph test -d`) — needs Docker Desktop running
```

## Tests

`tests/helpers.ts` builds a mock event per contract event (matching `abis/*.json`
byte-for-byte — every address/hash literal is length-checked). `tests/match-controller.test.ts`
and `tests/pit-router.test.ts` cover every handler: entity creation, the
`AgentResult` finalUsdc/pnl math, last-lock-wins on a repeated `RoundLocked`,
settlement writing `won`/`rebate` per participant in registration order, and the
swap-before-lock ordering in the pit-router handler. Also covers the
round-index-5-only status flip in `handleRoundLocked` (rounds 0-4 must leave
the match `LIVE`, not prematurely `LOCKED`).

**Compile-verified, not runtime-verified.** All four files (`helpers.ts`,
`match-controller.test.ts`, `pit-router.test.ts`) were compiled clean with the
real AssemblyScript compiler against the actually-installed `@graphprotocol/graph-ts`
and `matchstick-as` packages (`asc --noEmit --lib ../../node_modules`, exit 0,
no diagnostics) — every import, event-param getter, and entity-field type is
real and correct, not guessed. What hasn't run is the **Matchstick runtime**
itself (the WASM test binary that actually executes the handlers and checks
store state): native Matchstick has no Windows build (`graph test` →
"Unsupported platform"), and `graph test -d` needs Docker Desktop running,
which wasn't available here (`docker info` fails to reach the daemon). Run
`npm run test:docker` (start Docker Desktop first) or `npm test` on Linux/macOS
to get the actual pass/fail.

## Deploy (after contracts are live)

1. Fill real values in **`networks.json`** (address + deployment block for each contract).
2. `subgraph.yaml` reads placeholders — apply the network file:
   `npx graph build --network base-sepolia`
3. `npx graph auth <DEPLOY_KEY>` (key from https://thegraph.com/studio/)
4. `npm run deploy -- --version-label v0.0.1`
5. Watch the Studio dashboard until **synced to chainhead**.
6. Hand Suganthan the **Development Query URL** + API key + the working queries below.

Redeploy with a bumped `--version-label` on every contract redeploy.

## Freeze with Amalraj (day 1)

Confirm these exact signatures before he locks them (see `abis/*.json`):

```
AgentRegistered(address indexed agent, bytes32 commitHash, uint256 stake, uint256 indexed matchId)
MatchStarted(uint256 indexed matchId, uint256 startTime, address[] agents)
RoundLocked(uint256 indexed matchId, uint8 round, address indexed agent, uint256 usdcBalance, uint256 timestamp)
StrategyRevealed(uint256 indexed matchId, address indexed agent, string config)
MatchSettled(uint256 indexed matchId, address indexed winner, uint256[] rebateAmounts)
PickSubmitted(uint256 indexed matchId, address indexed spectator, address side)
AgentSwap(uint256 indexed matchId, uint8 round, address indexed agent, int256 amount0, int256 amount1, uint256 feeAccrued)   // emitted directly from PitRouter.swap() — v3 has no hook
```

If `rebateAmounts` is not index-aligned with participant registration order, tell
Suganthan — `handleMatchSettled` assumes it is.

## Smoke queries to hand off

```graphql
# a spectator board view
{
  match(id: "1") {
    status
    participants { id }
    rounds(orderBy: roundIndex) {
      roundIndex
      lockedAt
      locks { agent { id } usdcBalance }
    }
  }
}

# "my past matches" — feeds the agent's reasoning loop
{
  agentResults(
    where: { agent: "0xAGENT" }
    orderBy: match__createdAt
    orderDirection: desc
  ) {
    won
    pnl
    rebate
    finalUsdc
    match { id status }
  }
}
```
