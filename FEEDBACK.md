# Uniswap Developer Feedback — The Pit (ETHOnline 2026)

Feedback from building `backend/src/PitRouter.sol` + `backend/src/MatchController.sol`
against Uniswap v3 on Base Sepolia. Submitted alongside the Uniswap Developer
Feedback Form referenced in `README.md`.

## What went well

- **The Factory/Pool/NonfungiblePositionManager split is easy to build a
  custom router on top of.** Because v3 has no hook system, all of our
  enforcement (trade scoping, per-round cap, fee tracking) lives entirely in
  our own `PitRouter` contract wrapping `pool.swap()` — no privileged callback
  to register, no protocol-level flag bits to reason about. That made the
  contract itself small and easy to reason about (`backend/src/PitRouter.sol`
  is ~110 lines total).
- **`docs.uniswap.org/contracts/v3/reference/deployments/base-deployments`
  having the exact Base Sepolia addresses** (Factory, NonfungiblePositionManager,
  SwapRouter02, WETH9) made testnet setup fast — no digging through block
  explorers or Discord to find canonical testnet addresses.
- **Forking Base Sepolia in Foundry and hitting the real Factory/PositionManager
  worked with zero friction** — `vm.createSelectFork` against
  `https://sepolia.base.org`, then `Factory.createPool` + `Pool.initialize` +
  `NonfungiblePositionManager.mint` against the real deployed bytecode, no RPC
  quirks, no rate limiting during development. See
  `backend/test/ForkE2E.t.sol`.

## Friction points

1. **`sqrtPriceLimitX96 = 0` fails silently unhelpfully.** Passing `0` as
   "no limit" (a natural first guess, since it reads like "no floor") reverts
   with the bare string `"SPL"` and no further context. The valid values are
   `TickMath.MIN_SQRT_RATIO + 1` / `TickMath.MAX_SQRT_RATIO - 1`, but neither
   `IUniswapV3Pool` nor the swap function's NatSpec (in the public interface
   we referenced) states that `0` is invalid or what the actual valid range
   is — we found it by hitting the revert against the real forked pool
   (`backend/test/ForkE2E.t.sol`'s first failed run). A custom error instead
   of a 3-character revert string, or a one-line NatSpec on `swap()` stating
   the constraint, would have saved a debug cycle.
2. **Full-range tick bounds aren't derivable without off-chain tooling.**
   Minting a full-range house position needs `tickLower`/`tickUpper` aligned
   to the pool's `tickSpacing`, computed from `TickMath.MIN_TICK`/`MAX_TICK`.
   We ended up hand-computing `-887220`/`887220` for the 0.3% tier
   (`tickSpacing = 60`) rather than pulling in the full `v3-core` tick-math
   library, which is pinned to Solidity 0.7.6 and doesn't compose cleanly
   with a 0.8.x project without either vendoring just the math or eating a
   pragma downgrade. A small, pragma-agnostic tick-math helper package (or a
   documented set of the "standard" full-range bounds per fee tier) would
   remove a whole class of copy-pasted magic numbers across the ecosystem.
3. **No fee-per-swap event field.** `IUniswapV3PoolEvents.Swap` reports the
   net `amount0`/`amount1`, not the fee charged. We compute it ourselves
   (`feeAccrued = amountIn * fee / 1_000_000`, `backend/src/PitRouter.sol:99-105`)
   since our rebate mechanic needs it — that's a reasonable approximation for
   our purposes, but a protocol-level "fee actually collected this swap"
   return value (even just from `swap()`'s return, alongside amount0/amount1)
   would remove the need for every integrator building a rebate/fee-sharing
   mechanic to re-derive it.
4. **v3-core / v3-periphery's pinned solc 0.7.6 is the single biggest
   integration cost for a new 0.8.x project.** We ended up hand-reproducing
   the three interfaces we actually needed
   (`backend/src/interfaces/{IUniswapV3Factory,IUniswapV3Pool,INonfungiblePositionManager}.sol`)
   rather than `forge install`-ing the real periphery/core repos, purely to
   avoid a pragma conflict. A maintained, pragma-agnostic (`>=0.7.5 <0.9.0`)
   interfaces-only package (no implementation, just the ABI-shaping
   interfaces) would be a small, high-leverage addition for exactly this kind
   of integration.

## Where to look in our code

- Router enforcement + fee tracking: `backend/src/PitRouter.sol:64-83` (swap
  gating), `:98-105` (`_estimateFee`)
- Pool creation + house liquidity (deploy script): `backend/script/Deploy.s.sol`
- Real end-to-end proof against your Base Sepolia deployment:
  `backend/test/ForkE2E.t.sol`
