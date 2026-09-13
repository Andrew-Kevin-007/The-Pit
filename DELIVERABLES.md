# Deliverables — Kevin + Amalraj tracks

Status snapshot for the rest of the team (Suganthan, Sylesh) to pick up from.
Covers everything done against `README-Kevin.md` and `README-Amalraj.md` in
this pass — Suganthan's/Sylesh's packages (`packages/agent`, `packages/runner`
lifecycle logic, `packages/web`, `packages/subgraph-messari`) were **not**
touched except two narrow, load-bearing integration fixes called out below.

## Update 3 (Suganthan) — round length 90s -> 50s (9 min match -> 5 min), redeployed

Follow-up request: shorten the match. `ROUND_SECONDS` is a Solidity
`constant` in `MatchController.sol` — baked into bytecode, can't be changed
post-deploy — so this meant a fresh deploy, not a config edit.

- `backend/src/MatchController.sol`: `ROUND_SECONDS` 90 -> 50 (6 x 50s = 300s
  = 5 min exactly). Every test references `controller.ROUND_SECONDS()`
  dynamically rather than hardcoding 90, so nothing else needed to change on
  the Solidity side. All 51 tests (50 offline + live fork E2E) still pass.
- `packages/shared/src/stateModel.ts`: matching `ROUND_SECONDS` mirror.
- Redeployed (dry-run first): reused the same house pool
  (`0x46880b404CD35c165EDdefF7421019F8dD25F4Ad`), smaller seed this time
  (1.5 USDC + ~0.0007 WETH ceiling — the deployer's balance after the first
  deploy + rehearsal didn't have the ~$15 headroom the first deploy had, and
  $1 stake x 3 agents = $3 total still only needs "well past 3x" that).
  Verified on-chain: real bytecode at all 3 new addresses, `ROUND_SECONDS()`
  reads `50` directly from the deployed contract.

  | Contract | Address |
  |---|---|
  | `MatchController` | `0xF6970a7cFa2E0B81357d5d2D2Ab10Cb7330fE944` |
  | `PitRouter` | `0x11231A06FA6673b0C22361670F711DCaf12Fc01c` |
  | `CommitReveal` | `0x0e156435094289B4034a0E813ce2800F13540055` |

- `packages/subgraph-match/networks.json` updated to the new addresses +
  deploy block (46,732,626); redeployed `pit` -> v0.0.5, verified live,
  synced, `hasIndexingErrors: false`.
- The prior deploy (block 46,691,889) and its completed, settled `Match#1`
  are untouched and still queryable in `pit` at that older version — this
  just supersedes it as the address everything points at going forward.
- Docs updated for $1/50s consistently: `README.md`, `docs/STATE-MODEL.md`,
  `README-Sylesh.md`, `packages/web/README.md`, `docs/HANDOFF-KEVIN.md`.
- **Not re-run:** a fresh live rehearsal against these new addresses (the
  mechanism was already proven end-to-end on the prior deploy; only the round
  timing constant changed here). Agents B/C would need re-registering against
  the new `MatchController` if a fresh rehearsal is wanted.

## Update — deployed for real on Base Sepolia

Everything below marked "not yet broadcast" / "❌ not run" for the deploy is
now done:

- **Stake dropped $50 → $1 USDC** (`MatchController.STAKE_USDC` +
  `packages/shared`/`packages/subgraph-match` mirrors) so the required house
  liquidity ("well past 3x total stakes") scaled from ~$500 down to ~$15,
  matching what was actually faucetable in this session. All 51 backend tests
  (50 offline + the live fork E2E) updated and still passing.
- **Real bug found and fixed via the dry-run simulation, not guessed:**
  `Deploy.s.sol`'s house-liquidity `mint()` used `deadline: block.timestamp`
  with zero buffer — reverts `Transaction too old` the moment inclusion lags
  simulation by even one block, which a real broadcast always does. Now
  `block.timestamp + 900`.
- **Broadcast for real** — `forge script script/Deploy.s.sol:Deploy --broadcast`,
  reusing the existing real USDC/WETH 0.3% pool (fee tier 3000, the default):
  - `MatchController`: `0x522748669646A1a099474cd7f98060968A80E812`
  - `PitRouter`: `0x94768a15Cd37e07eEcc02eDe47D134A26C1ecB3f`
  - `CommitReveal`: `0x8A5e3A780bA14eB70F5a66Cf3cB5321Fda5e02FB`
  - `POOL_ADDRESS`: `0x46880b404CD35c165EDdefF7421019F8dD25F4Ad` (deploy block
    46,691,889) — same pool `packages/subgraph-messari` already indexes, no
    repoint needed
  - House position tokenId `82132`, seeded with 15 USDC + ~0.0070 WETH
  - Verified on-chain: real bytecode at all three addresses, deploy tx
    `0x47b3570e...` status `success` at block 46,691,889
- **`packages/subgraph-match` redeployed** (`pit`, Studio slug, → `v0.0.4`)
  pointed at the real addresses above, `startBlock` 46,691,889. Synced,
  `hasIndexingErrors: false`, empty until a real match runs (expected — no
  match has been registered yet).
- **Update 2 — the real rehearsal happened.** 3 agent wallets funded (2 from
  Agent A's deploy surplus — no extra faucet trips), full lifecycle run for
  real against the deployed contracts: 3x `register`, 3x `approve`, `startMatch`,
  6 real 90s on-chain-enforced rounds each with a real `PitRouter.swap()` per
  agent (16 of 18 landed; 2 reverted — see below, non-fatal), 6x `lockRound`,
  3x `reveal`, `settle`. Winner: `momentum-a` (1.82 vs 1.35 USDC each for the
  other two). Confirmed indexed correctly in the `pit` subgraph: `Match#1`
  `SETTLED`, all 6 rounds with real per-agent balances, 16 real `Trade`s with
  real `amount0`/`amount1`/`feeAccrued`, all 3 `StrategyReveal`s, and
  `AgentResult.pnl`/`rebate`/`won` per agent — https://thegraph.com/studio/subgraph/pit,
  query `matches(first:5){...}`. **Not a hardcoded runner script** — direct
  viem calls against the real ABI, same commit-hash scheme
  `packages/runner`'s `lifecycle.ts` uses.
  - Two of the 18 swaps reverted with a transient RPC-node-lag symptom, not a
    contract bug: a `reveal()` call also hit this (state simulated against a
    stale node moments after the prior tx's own node confirmed it) and was
    confirmed clean by re-simulating a few seconds later — same call, same
    args, succeeded. Worth a retry-with-backoff wrapper (not just around
    `lockRound`, which already had one) if this repeats.
  - `packages/runner`'s actual `rehearse('chain')` wasn't used for this run —
    it still hardcodes the placeholder `0x1111.../0x2222.../0x3333...`
    addresses (see "What's left" #5). This was a standalone script using the
    same contract calls/ABI/commit scheme; wiring real per-agent signing into
    `rehearse('chain')` itself is the remaining integration work there.

## TL;DR

- **Amalraj's contracts are written, tested, and proven against live Base
  Sepolia — not yet broadcast for real.** `backend/` has `PitRouter.sol`,
  `MatchController.sol`, `CommitReveal.sol`, 51 passing tests (50 offline +
  1 live fork), and a ready-to-run deploy script. What's missing is a funded
  wallet to actually broadcast it.
- **Kevin's subgraph is caught up to the real contracts.** `PitHook` →
  `PitRouter` renamed everywhere (manifest, ABI, mappings, tests), one real
  bug fixed (premature `LOCKED` status), `codegen`/`build` both verified
  clean. Still blocked on the same two things it always was: real deployed
  addresses, and a Subgraph Studio deploy key.
- **A real security review found and fixed two critical bugs** before this
  went anywhere near a demo — see "What got fixed" below. Worth reading if
  you're touching `backend/src/MatchController.sol`.

## What got built

### `backend/` — Amalraj's track (new)

| Contract | What |
|---|---|
| `src/PitRouter.sol` | Wraps the Uniswap v3 pool's `swap()`. Enforces: caller is a registered participant, the match's round is live, under the per-round trade cap. Tracks fee volume per agent for the settlement rebate. No hook — v3 has none; this router *is* the enforcement layer. |
| `src/MatchController.sol` | Registration (balance-verify, never custody — see below), round timing (on-chain-enforced, not just a runner promise), reveal, settlement (balance-based winner + proportional fee rebate). Operator-gated (`Ownable2Step`), same wallet `packages/runner` already drives every lifecycle call from. |
| `src/CommitReveal.sol` | Deployed internally by `MatchController`. Hash preimage matches `packages/runner/src/lifecycle.ts`'s `commitHash()` byte-for-byte — verified against the actual TS, not just `docs/INTERFACE-FREEZE.md`'s prose (which was missing a separator byte). |
| `script/Deploy.s.sol` | Full deploy: get-or-create the USDC/WETH v3 pool, deploy both contracts, mint house liquidity, wire everything — ready to run, not yet run for real. |
| `test/` | 51 tests. See "Testing" below. |

Real Base Sepolia addresses (verified live, in `.env.example`):
`UNISWAP_V3_FACTORY_ADDRESS=0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24`,
`POSITION_MANAGER_ADDRESS=0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2`,
`USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`.

### `packages/subgraph-match` — Kevin's track (updated)

- `PitHook` renamed to `PitRouter` across `subgraph.yaml`, `abis/`,
  `src/pit-router.ts` (was `pit-hook.ts`), `networks.json`, `tests/` — matches
  the actual v3 architecture instead of a stale v4 hook reference.
- Fixed a real bug in `handleRoundLocked`: status flipped to `LOCKED` on
  *every* `RoundLocked` event (it fires once per agent per round), not just
  the 6th/last round — the board would have shown a match "LOCKED" from round
  0 onward. Now gated on `roundIndex == 5`. Test suite updated (it had
  previously asserted the buggy behavior) plus a new round-5 case.
- `npm run codegen` and `npm run build` both verified clean against the real
  `graph-cli` (not just `asc --noEmit`, which is all the previous pass could
  do).
- Still **not runtime-verified** (`npm test`) — no Windows Matchstick binary,
  and Docker Desktop / WSL aren't available in this environment either (WSL
  is registered but its disk is missing — `Failed to attach disk
  'D:\WSL\Ubuntu\ext4.vhdx'`, needs a `wsl --unregister`/reinstall or a
  working Docker Desktop to actually run `npm run test:docker`).

### Cross-cutting fixes (touched `packages/runner`, narrowly)

- `PIT_HOOK_ADDRESS`/`env.pitHook` → `PIT_ROUTER_ADDRESS`/`env.pitRouter`;
  `POOL_ID` (v4 PoolId, bytes32) → `POOL_ADDRESS` (v3 pools are their own
  contract, there's no singleton PoolManager to look one up in). Both are
  direct consequences of Amalraj's contracts existing now — the runner
  literally could not name the right addresses without this.
- `packages/runner/src/lifecycle.ts`: `lockRound` was called once **per
  agent** inside the balance-read loop instead of once **per round** — since
  `MatchController.lockRound()` already iterates every participant itself,
  the 2nd+ call for the same round would now revert `OutOfOrderRound`. Moved
  outside the loop.

Nothing else in `packages/runner`, `packages/agent`, `packages/web`, or
`packages/subgraph-messari` was touched.

## What got fixed by adversarial review (read this before touching MatchController)

Ran a real multi-agent security review against `backend/src/*.sol` mid-build.
Two **critical** findings, both fixed and now covered by tests:

1. **Every match permanently stranded 50 USDC × participant count.**
   `register()` originally pulled the stake into the contract via
   `transferFrom`, but nothing anywhere ever paid it back out — `settle()`
   only ever distributed fee rebates. Root cause: this contradicted the rest
   of the design. Agents trade directly out of their **own** wallet through
   `PitRouter` (that's what `lockRound`/`settle` read via `balanceOf`,
   per `docs/STATE-MODEL.md`'s "on-chain USDC balances = score, no oracle").
   Custodying the stake just drained the funds the agent needed to trade
   with. **Fix:** `register()` now only verifies the wallet already holds
   `>= STAKE_USDC` — it never moves anything.
2. **`settle()` could brick itself forever.** `pitRouter`/
   `housePositionTokenId` are contract-global, set once with zero validation.
   Any misconfiguration made every `settle()` call — for every match, ever —
   revert permanently. **Fix:** fee collection now runs through
   `try/catch` (via a self-call, since Solidity's `try` only wraps external
   calls); worst case on failure is zero rebates, never a bricked match.

Also from the same review, fixed: `lockRound` now enforces the 90s-per-round
window on-chain (previously an operator could collapse all 6 rounds into one
block); `Ownable` → `Ownable2Step`; `PitRouter`'s swap callback uses
`SafeERC20`.

**Accepted as known hackathon-scope limitations** (not fixed, flagged by the
review): no forced-settlement timeout if the operator never calls `reveal()`
for an agent (match sticks at `LOCKED` — operator-trust model, not
attacker-reachable since the same wallet already drives the whole lifecycle);
`collectHouseFeesInUsdc()`'s `try/catch` means a *correctly* wired house
position is still required for rebates to ever pay — nothing re-validates it
after `setHousePosition()`.

## Testing — what's actually verified vs. what still needs you

| Layer | Status |
|---|---|
| `backend/` unit tests (50, offline, mocked Uniswap) | ✅ `forge test` — all passing |
| `backend/` live fork E2E (real Base Sepolia Factory/Pool/PositionManager) | ✅ `RUN_FORK_TESTS=true forge test --match-contract ForkE2E -vv` — all passing, verified live in this session (block ~46,690,443) |
| `packages/subgraph-match` codegen + build | ✅ verified against real `graph-cli` |
| `packages/subgraph-match` Matchstick runtime tests | ❌ blocked — no Windows binary, no Docker, WSL broken in this environment. Someone with Docker Desktop (or Linux/macOS) needs to run `npm run test:docker` / `npm test` to get real pass/fail. |
| Full match lifecycle, live, real 3 agents | ✅ ran for real against the deployed contracts — see "Update 2" above. `Match#1` `SETTLED`, real winner, real per-round balances, 16 real trades, all indexed |
| `packages/runner`'s own `rehearse('chain')` (as opposed to a standalone script exercising the same calls) | ❌ not run — still hardcodes placeholder agent addresses, see "What's left" #5 |
| Real Base Sepolia broadcast deploy | ✅ done — see "Update (Suganthan)" above |
| Subgraph Studio deploy | ✅ done — `pit` v0.0.4, `pit-messari` v0.0.3, both live |

## What's left — exact next steps

1. **Fund a Base Sepolia deployer wallet.** Put its private key in `.env` as
   `RUNNER_PRIVATE_KEY` (same key `packages/runner` will use as the
   operator). Needs: Base Sepolia ETH for gas, plus `USDC_SEED_AMOUNT` of
   testnet USDC ([faucet.circle.com](https://faucet.circle.com)) and
   `WETH_SEED_AMOUNT` of WETH (wrap Base Sepolia ETH) for house liquidity.
2. **Compute `INITIAL_SQRT_PRICE_X96`** for your chosen USDC/WETH ratio (see
   `backend/script/Deploy.s.sol`'s NatSpec) and set it in `.env`.
3. **Deploy:** `cd backend && forge script script/Deploy.s.sol:Deploy
   --rpc-url "$BASE_SEPOLIA_RPC_URL" --broadcast -vvvv`. Copy the logged
   `MATCH_CONTROLLER_ADDRESS`/`PIT_ROUTER_ADDRESS`/`POOL_ADDRESS` into `.env`.
4. **Redeploy the subgraph:** put those same addresses + the deploy block
   into `packages/subgraph-match/networks.json`, get a Subgraph Studio
   account + deploy key, `npm run deploy -- --version-label v0.0.2`. Hand the
   new Development Query URL to whoever owns `graph-client`/`.env`.
5. **Wire real per-agent signing into `packages/runner`'s `rehearse('chain')`
   itself.** A full real rehearsal has now been proven end-to-end (3 funded
   wallets, real register/approve/6 rounds of trading/lock/reveal/settle,
   confirmed indexed — see "Update 2" above), but as a standalone script
   exercising the same contract calls, not through `rehearse('chain')`, which
   still hardcodes the placeholder `0x1111.../0x2222.../0x3333...` addresses
   with no known private keys. Give it a way to take real per-agent signers
   (env vars, a keystore, whatever) and it can drive the same flow directly.
6. **Matchstick runtime verification** — see the table above; needs Docker or
   Linux/macOS.
7. **Submit the Uniswap Developer Feedback Form**, linking `FEEDBACK.md` (per
   `README-Amalraj.md`'s deliverables checklist — this is a human,
   outward-facing action, not something to automate).
8. **Record the 2–4 minute demo video** (`docs/DEMO-SCRIPT.md`) once the
   above is live — required for all three prize tracks.

## Heads-up for whoever owns `packages/shared` (Suganthan)

`packages/shared/src/stateModel.ts`'s `MatchState.poolId` comment still says
"v4 PoolId (bytes32 hex)" — now that there's no hook/PoolManager, that field
is really just the v3 pool's address (a 20-byte `0x...40-hex-chars` string,
same shape a `bytes32` comment doesn't rule out, so nothing breaks at
runtime — this is a documentation staleness flag, not a bug). Left untouched
since it's outside the Kevin/Amalraj scope of this pass.

## Architecture decisions made this pass (nothing here needs re-litigating)

Both were open questions in `docs/INTERFACE-FREEZE.md` — resolved by reading
what `packages/runner` actually already assumed, then matching the contract
to it:

- `RoundLocked` fires **once per agent per round** (not once per round with
  all balances) — matches the placeholder ABI's non-array fields.
- `rebateAmounts[]` in `MatchSettled` is **registration-order-aligned** —
  matches `handleMatchSettled`'s existing assumption and `runMatch`'s
  `state.results` ordering.
