# @the-pit/subgraph-messari

**Graph Track 1 — Best Use of Composable or Standardized Graph Products ($5,000).**
Owner: Suganthan. See [`../../README-Suganthan.md`](../../README-Suganthan.md) §A / Phase 3.

The **Messari Standardized DEX AMM (Extended)** schema — entity and field names
byte-identical to the canonical
[`schema-dex-amm.graphql`](https://github.com/messari/subgraphs/blob/master/schema-dex-amm.graphql) —
populated from a **single Uniswap v3 pool contract** directly. v3 has no
singleton: every pool is its own contract, so this indexes exactly the one
pool PitRouter wraps, not a factory-wide sweep of every pool on Base Sepolia.

## Status: deployed, live, indexing real data

Studio slug **`pit-messari`**, `v0.0.3`:
https://thegraph.com/studio/subgraph/pit-messari — synced, `hasIndexingErrors: false`,
indexing a **real, already-initialized Base Sepolia USDC/WETH 0.3% pool**
(`0x46880b404CD35c165EDdefF7421019F8dD25F4Ad`, found live via the real
`UNISWAP_V3_FACTORY_ADDRESS` from `.env.example`) as a stand-in for the house
pool until PitRouter is deployed. 400+ real swaps and real deposits (with real
token amounts, not zeros) and counting. No mock/local/static data.

## Why this qualifies

- **Standardized schema, not a bespoke one.** Any tool that reads a Messari DEX
  AMM subgraph reads this unchanged. `@the-pit/graph-client`'s `messariSubgraph.ts`
  queries only standard fields — repoint it at any other Messari DEX AMM subgraph
  and it still runs. The schema itself doesn't say "v3" anywhere; only the
  mapping (`src/pool.ts`) is protocol-specific.
- **Composed** with `@the-pit/subgraph-match` on `Match.poolId` in
  `graph-client/src/composed.ts` (`buildRoundContext`) — two Graph products, one
  analysis function.

## v3 mapping

| v3 pool event | Messari entity |
|---|---|
| `Initialize(sqrtPriceX96, tick)` | refines `LiquidityPool.tick`/`_sqrtPriceX96`/`createdTimestamp` on the pool `getOrCreatePool` already made |
| `Swap(sender, recipient, amount0, amount1, sqrtPriceX96, liquidity, tick)` | `Swap` (`tokenIn/amountIn/tokenOut/amountOut`, `tick`) + pool CL state, cumulative volume, `Account`, daily/usage snapshots |
| `Mint(sender, owner, tickLower, tickUpper, amount, amount0, amount1)` | `Deposit` — real `inputTokenAmounts`, unlike a v4 `ModifyLiquidity` event which doesn't carry them |
| `Burn(owner, tickLower, tickUpper, amount, amount0, amount1)` | `Withdraw` — same |

**Pools are created lazily**, on the first event seen for them — not only on
`Initialize`. A real v3 pool is almost always initialized well before this
subgraph's `startBlock` (this one certainly was), so gating pool creation on
catching `Initialize` would silently drop every Swap/Mint/Burn after it.
`getOrCreatePool()` fetches `token0()`/`token1()`/`fee()` via `eth_call` the
first time any event for that pool address arrives — the "cache contract data
once, on first sight" pattern from `.claude/skills/subgraph-optimization`.
`Initialize`'s `token0()`/`token1()`/`fee()` calls are additionally declared in
the manifest (`calls:`) for the common case where it *is* caught, so that path
runs in parallel instead of a blocking synchronous call.

USD fields exist (part of the standard) but are `0` — no price oracle on Base
Sepolia. Every non-USD field is populated from chain data.

## Tests

`tests/helpers.ts` builds mock `Initialize` / `Swap` / `Mint` / `Burn` events
plus `mockPoolContract()` for the `token0`/`token1`/`fee` calls (every
address/`bytes32` literal length-checked). `tests/pool.test.ts` covers: pool +
protocol + token + fee creation, lazy pool creation from a bare `Swap` with no
prior `Initialize`, the buy/sell direction flip on `amount0`'s sign,
unique-account counting across repeated swaps from the same sender (`tx.from`,
not the swap's `recipient`), and `Mint`/`Burn` producing `Deposit`/`Withdraw`
with real token amounts and correctly signed `liquidityDelta`.

`getOrCreateProtocol()` is keyed by the Factory address (a constant), not
`dataSource.address()` — in this design `dataSource.address()` *is* the pool's
own address (one data source per pool), which would make the protocol entity
churn per pool instead of being the one stable parent every `LiquidityPool`
hangs off.

**Compile-verified, not runtime-verified.** Both files were compiled clean with
the real AssemblyScript compiler against the actually-installed
`@graphprotocol/graph-ts` / `matchstick-as` packages (`asc --noEmit --lib
../../node_modules`, exit 0, no diagnostics). What hasn't run is the Matchstick
runtime itself — no Windows binary, and `graph test -d` needs Docker Desktop
running (unavailable here). Run `npm run test:docker` (Docker Desktop started)
or `npm test` on Linux/macOS for the actual pass/fail.

## Before the next deploy (polish, not blocking)

- [ ] Once PitRouter is deployed, point `networks.json` / `subgraph.yaml` at the
  real house pool address (`PitRouter.pool()`) instead of the USDC/WETH stand-in,
  and set `startBlock` to that pool's actual `Initialize` block (or leave it —
  lazy pool creation means it'll pick up the pool correctly either way; a
  tighter `startBlock` just means less unrelated-block scanning before it does)
- [ ] `src/constants.ts` `knownToken()` — add the house pool's real token
  addresses (USDC + whatever the counter-token is) so symbols resolve instead
  of falling back to `???`

## Workflow

```bash
npm install
npm run codegen && npm run build
npm test              # matchstick, native — see Tests above (needs Linux/macOS)
npm run test:docker   # matchstick via Docker
npx graph auth <DEPLOY_KEY>
npm run deploy -- --version-label v0.0.4   # bump the label each redeploy
```

Query URL + deployment ID are in the root `.env` (`MESSARI_SUBGRAPH_URL`,
`MESSARI_SUBGRAPH_DEPLOYMENT_ID`).
