import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts"
import {
  Initialize,
  Mint,
  Burn,
  Swap as SwapEvent,
  UniswapV3Pool,
} from "../generated/UniswapV3Pool/UniswapV3Pool"
import {
  DexAmmProtocol,
  LiquidityPool,
  LiquidityPoolFee,
  Swap,
  Deposit,
  Withdraw,
} from "../generated/schema"
import { feeTierId, ZERO_BD, ZERO_BI } from "./constants"
import {
  eventPk,
  getOrCreatePoolDaySnapshot,
  getOrCreateProtocol,
  getOrCreateToken,
  getOrCreateUsageDaySnapshot,
  touchAccount,
} from "./helpers"

/**
 * Lazily creates the pool the first time we see ANY of its events — not just
 * `Initialize`. A real v3 pool's `Initialize` fires exactly once, at whatever
 * block it happened; if that's before this subgraph's `startBlock` (likely,
 * for any pool that already existed) every later Swap/Mint/Burn would
 * otherwise be silently dropped by a "pool not found" guard. Cache-once via
 * eth_call instead (see .claude/skills/subgraph-optimization, "Solution 3").
 * `handleInitialize` still runs this and then refines tick/sqrtPriceX96/
 * createdAt with the exact values from the event, when we do catch it.
 */
function getOrCreatePool(
  poolAddr: Address,
  protocol: DexAmmProtocol,
  block: ethereum.Block
): LiquidityPool {
  let pool = LiquidityPool.load(poolAddr)
  if (pool != null) return pool as LiquidityPool

  const contract = UniswapV3Pool.bind(poolAddr)
  const t0 = getOrCreateToken(contract.token0())
  const t1 = getOrCreateToken(contract.token1())
  const feeTier = contract.fee()

  const fee = new LiquidityPoolFee(feeTierId(poolAddr))
  fee.feeType = "FIXED_TRADING_FEE"
  // v3 fee is hundredths of a bip (1e-6). percentage = fee / 10000.
  fee.feePercentage =
    feeTier == 0
      ? ZERO_BD
      : BigInt.fromI32(feeTier).toBigDecimal().div(BigInt.fromI32(10000).toBigDecimal())
  fee.save()

  pool = new LiquidityPool(poolAddr)
  pool.protocol = protocol.id
  pool.name = t0.symbol + " / " + t1.symbol
  pool.symbol = t0.symbol + "-" + t1.symbol
  pool.inputTokens = [t0.id, t1.id]
  pool.fees = [fee.id]
  pool.isSingleSided = false
  pool.createdTimestamp = block.timestamp
  pool.createdBlockNumber = block.number
  pool.tick = ZERO_BI
  pool._sqrtPriceX96 = ZERO_BI
  pool.totalValueLockedUSD = ZERO_BD
  pool.cumulativeVolumeUSD = ZERO_BD
  pool.inputTokenBalances = [ZERO_BI, ZERO_BI]
  pool.inputTokenWeights = [
    BigInt.fromI32(50).toBigDecimal(),
    BigInt.fromI32(50).toBigDecimal(),
  ]
  pool.activeLiquidity = ZERO_BI
  pool.cumulativeVolumeByTokenAmount = [ZERO_BI, ZERO_BI]
  pool.cumulativeSwapCount = 0
  pool.cumulativeDepositCount = 0
  pool.cumulativeWithdrawCount = 0
  pool.save()

  protocol.totalPoolCount += 1
  protocol.save()
  return pool as LiquidityPool
}

export function handleInitialize(event: Initialize): void {
  const protocol = getOrCreateProtocol()
  const pool = getOrCreatePool(event.address, protocol, event.block)

  // Initialize is the precise creation moment when we do catch it — refine
  // over the lazy-create defaults above.
  pool.tick = BigInt.fromI32(event.params.tick)
  pool._sqrtPriceX96 = event.params.sqrtPriceX96
  pool.createdTimestamp = event.block.timestamp
  pool.createdBlockNumber = event.block.number
  pool.save()

  getOrCreateUsageDaySnapshot(event.block)
}

export function handleSwap(event: SwapEvent): void {
  const protocol = getOrCreateProtocol()
  const pool = getOrCreatePool(event.address, protocol, event.block)

  const a0 = event.params.amount0
  const a1 = event.params.amount1
  const tokens = pool.inputTokens

  const swap = new Swap(eventPk(event.transaction.hash, event.logIndex))
  swap.hash = event.transaction.hash
  swap.logIndex = event.logIndex.toI32()
  swap.protocol = protocol.id
  swap.to = event.params.recipient
  swap.from = event.transaction.from
  swap.blockNumber = event.block.number
  swap.timestamp = event.block.timestamp
  swap.tick = BigInt.fromI32(event.params.tick)
  swap.pool = pool.id
  swap.amountInUSD = ZERO_BD
  swap.amountOutUSD = ZERO_BD

  // v3 sign convention: a positive delta flows INTO the pool.
  if (a0.gt(ZERO_BI)) {
    swap.tokenIn = tokens[0]
    swap.amountIn = a0
    swap.tokenOut = tokens[1]
    swap.amountOut = a1.neg()
  } else {
    swap.tokenIn = tokens[1]
    swap.amountIn = a1
    swap.tokenOut = tokens[0]
    swap.amountOut = a0.neg()
  }
  swap.save()

  pool.tick = BigInt.fromI32(event.params.tick)
  pool._sqrtPriceX96 = event.params.sqrtPriceX96
  pool.activeLiquidity = event.params.liquidity
  pool.cumulativeSwapCount += 1
  const vol = pool.cumulativeVolumeByTokenAmount
  vol[0] = vol[0].plus(a0.abs())
  vol[1] = vol[1].plus(a1.abs())
  pool.cumulativeVolumeByTokenAmount = vol
  pool.save()

  protocol.cumulativeSwapCount += 1
  if (touchAccount(event.transaction.from, "swap")) {
    protocol.cumulativeUniqueUsers += 1
  }
  protocol.save()

  const daySnap = getOrCreatePoolDaySnapshot(pool, event.block)
  daySnap.dailySwapCount += 1
  const dv = daySnap.dailyVolumeByTokenAmount
  dv[0] = dv[0].plus(a0.abs())
  dv[1] = dv[1].plus(a1.abs())
  daySnap.dailyVolumeByTokenAmount = dv
  daySnap.save()

  const usage = getOrCreateUsageDaySnapshot(event.block)
  usage.dailySwapCount += 1
  usage.save()
}

export function handleMint(event: Mint): void {
  const protocol = getOrCreateProtocol()
  const pool = getOrCreatePool(event.address, protocol, event.block)
  const tokens = pool.inputTokens

  const d = new Deposit(eventPk(event.transaction.hash, event.logIndex))
  d.hash = event.transaction.hash
  d.logIndex = event.logIndex.toI32()
  d.protocol = protocol.id
  d.to = event.params.owner
  d.from = event.params.sender
  d.blockNumber = event.block.number
  d.timestamp = event.block.timestamp
  d.inputTokens = [tokens[0], tokens[1]]
  d.inputTokenAmounts = [event.params.amount0, event.params.amount1]
  d.amountUSD = ZERO_BD
  d.tickLower = BigInt.fromI32(event.params.tickLower)
  d.tickUpper = BigInt.fromI32(event.params.tickUpper)
  d.liquidityDelta = event.params.amount
  d.pool = pool.id
  d.save()

  pool.cumulativeDepositCount += 1
  pool.activeLiquidity = pool.activeLiquidity.plus(event.params.amount)
  pool.save()

  if (touchAccount(event.params.sender, "deposit")) {
    protocol.cumulativeUniqueUsers += 1
  }
  protocol.save()
}

export function handleBurn(event: Burn): void {
  const protocol = getOrCreateProtocol()
  const pool = getOrCreatePool(event.address, protocol, event.block)
  const tokens = pool.inputTokens

  const w = new Withdraw(eventPk(event.transaction.hash, event.logIndex))
  w.hash = event.transaction.hash
  w.logIndex = event.logIndex.toI32()
  w.protocol = protocol.id
  w.to = event.params.owner
  w.from = event.params.owner
  w.blockNumber = event.block.number
  w.timestamp = event.block.timestamp
  w.inputTokens = [tokens[0], tokens[1]]
  w.inputTokenAmounts = [event.params.amount0, event.params.amount1]
  w.amountUSD = ZERO_BD
  w.tickLower = BigInt.fromI32(event.params.tickLower)
  w.tickUpper = BigInt.fromI32(event.params.tickUpper)
  w.liquidityDelta = event.params.amount.neg()
  w.pool = pool.id
  w.save()

  pool.cumulativeWithdrawCount += 1
  pool.activeLiquidity = pool.activeLiquidity.minus(event.params.amount)
  pool.save()

  if (touchAccount(event.params.owner, "withdraw")) {
    protocol.cumulativeUniqueUsers += 1
  }
  protocol.save()
}
