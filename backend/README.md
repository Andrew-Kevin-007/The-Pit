# backend — The Pit's Uniswap v3 contracts

Foundry project covering Amalraj's track (`PitRouter`, `MatchController`,
`CommitReveal`) and the deploy path Kevin's `packages/subgraph-match` indexes
against. Rule-by-rule pointers for the Uniswap Foundation track are in the
[top-level README](../README.md#uniswap-contracts--exact-files--line-numbers);
this file is the build/test/deploy guide.

## Layout

| Path | What |
|---|---|
| `src/PitRouter.sol` | On-chain referee — wraps `pool.swap()`, enforces trade scoping + per-round cap, tracks fee volume for the settlement rebate |
| `src/MatchController.sol` | Registration, round timing, reveal, settlement — operator-gated (the same wallet `packages/runner` drives from), never custodies agent funds |
| `src/CommitReveal.sol` | Strategy-config commit/reveal, deployed internally by `MatchController` |
| `src/interfaces/` | Minimal, locally-reproduced Uniswap v3 interfaces (Factory/Pool/NonfungiblePositionManager) — see `FEEDBACK.md` for why these aren't `forge install`ed from `v3-core`/`v3-periphery` |
| `script/Deploy.s.sol` | Full Base Sepolia deploy: get-or-create the pool, deploy both contracts, seed house liquidity, wire everything together |
| `test/*.t.sol` | Offline unit tests (mocked Uniswap) — 50 tests |
| `test/ForkE2E.t.sol` | Live Base Sepolia fork — the real Factory/Pool/PositionManager, full match lifecycle, opt-in via `RUN_FORK_TESTS=true` |
| `test/mocks/` | `MockERC20`, `MockUniswapV3Pool` (real v3 swap/callback semantics, 1:1 rate), `MockPositionManager` |

## Setup

```bash
# one-time — fetches forge-std + OpenZeppelin (gitignored, not vendored)
forge install foundry-rs/forge-std --no-git
forge install OpenZeppelin/openzeppelin-contracts --no-git
```

## Build + test

```bash
forge build
forge test              # 50 tests, fully offline (mocked Uniswap v3)

# the real end-to-end proof — forks live Base Sepolia, needs network access
RUN_FORK_TESTS=true forge test --match-contract ForkE2E -vv
```

## Deploy to Base Sepolia

Fill in `.env` at the repo root (see `.env.example`): `RUNNER_PRIVATE_KEY`
(deployer + MatchController operator — same wallet `packages/runner` uses),
`UNISWAP_V3_FACTORY_ADDRESS`, `POSITION_MANAGER_ADDRESS`, `USDC_ADDRESS`
(all pre-filled with the real Base Sepolia values), plus `USDC_SEED_AMOUNT`,
`WETH_SEED_AMOUNT`, and `INITIAL_SQRT_PRICE_X96` for the house liquidity —
see the NatSpec at the top of `script/Deploy.s.sol` for how to compute the
last one. The deployer wallet needs Base Sepolia ETH (for gas) and that much
real testnet USDC ([faucet.circle.com](https://faucet.circle.com)) + WETH
(wrap Base Sepolia ETH) in hand before running this.

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url "$BASE_SEPOLIA_RPC_URL" \
  --broadcast \
  -vvvv
```

The script logs `MATCH_CONTROLLER_ADDRESS` / `PIT_ROUTER_ADDRESS` /
`POOL_ADDRESS` at the end — copy those into `.env` and into
`packages/subgraph-match/networks.json`, then redeploy the subgraph (see
`packages/subgraph-match/README.md`).

## Known limitations (hackathon scope, see `../DELIVERABLES.md`)

- No forced-settlement path if the operator never calls `reveal()` for an
  agent — the match sticks at `LOCKED`. Operator-trust model (same wallet
  drives the whole lifecycle already), not attacker-reachable.
- `collectHouseFeesInUsdc()` is wrapped in `try/catch` so a misconfigured
  house position degrades to zero rebates rather than bricking `settle()` —
  but a *correctly* configured one is still required for rebates to ever pay
  out; nothing re-validates the position after `setHousePosition()`.
