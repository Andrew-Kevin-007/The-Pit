import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import {
  Account,
  DexAmmProtocol,
  LiquidityPool,
  LiquidityPoolDailySnapshot,
  Token,
  UsageMetricsDailySnapshot,
} from "../generated/schema"
import {
  FACTORY,
  METHODOLOGY_VERSION,
  PROTOCOL_NAME,
  PROTOCOL_SLUG,
  SCHEMA_VERSION,
  SECONDS_PER_DAY,
  SUBGRAPH_VERSION,
  ZERO_BD,
  ZERO_BI,
  knownToken,
} from "./constants"

export function getOrCreateProtocol(): DexAmmProtocol {
  // Keyed by the Factory, not dataSource.address() — v3 has no singleton, and
  // dataSource.address() here is the POOL's own address (one data source per
  // pool), which would make the protocol entity churn per pool instead of
  // being the one stable parent every LiquidityPool hangs off.
  const id = FACTORY
  let p = DexAmmProtocol.load(id)
  if (p != null) return p as DexAmmProtocol

  p = new DexAmmProtocol(id)
  p.name = PROTOCOL_NAME
  p.slug = PROTOCOL_SLUG
  p.schemaVersion = SCHEMA_VERSION
  p.subgraphVersion = SUBGRAPH_VERSION
  p.methodologyVersion = METHODOLOGY_VERSION
  p.network = "BASE_SEPOLIA"
  p.type = "EXCHANGE"
  p.totalValueLockedUSD = ZERO_BD
  p.cumulativeVolumeUSD = ZERO_BD
  p.cumulativeTotalRevenueUSD = ZERO_BD
  p.totalPoolCount = 0
  p.cumulativeUniqueUsers = 0
  p.cumulativeSwapCount = 0
  p.save()
  return p as DexAmmProtocol
}

export function getOrCreateToken(addr: Address): Token {
  let t = Token.load(addr)
  if (t != null) return t as Token

  t = new Token(addr)
  const meta = knownToken(addr)
  if (meta != null) {
    t.name = meta[0]
    t.symbol = meta[1]
    t.decimals = BigInt.fromString(meta[2]).toI32()
  } else {
    t.name = "Unknown"
    t.symbol = "???"
    t.decimals = 18
  }
  t.save()
  return t as Token
}

/** Returns true the first time this address is seen (for unique-user counting). */
export function touchAccount(
  addr: Bytes,
  kind: string /* "swap" | "deposit" | "withdraw" */
): boolean {
  let acct = Account.load(addr)
  let isNew = false
  if (acct == null) {
    acct = new Account(addr)
    acct.swapCount = 0
    acct.depositCount = 0
    acct.withdrawCount = 0
    isNew = true
  }
  if (kind == "swap") acct.swapCount += 1
  else if (kind == "deposit") acct.depositCount += 1
  else if (kind == "withdraw") acct.withdrawCount += 1
  acct.save()
  return isNew
}

export function dayId(ts: BigInt): i32 {
  return ts.toI32() / SECONDS_PER_DAY
}

export function getOrCreatePoolDaySnapshot(
  pool: LiquidityPool,
  block: ethereum.Block
): LiquidityPoolDailySnapshot {
  const day = dayId(block.timestamp)
  const id = pool.id.concatI32(day)
  let snap = LiquidityPoolDailySnapshot.load(id)
  if (snap == null) {
    snap = new LiquidityPoolDailySnapshot(id)
    snap.day = day
    snap.protocol = pool.protocol
    snap.pool = pool.id
    snap.dailyVolumeByTokenAmount = [ZERO_BI, ZERO_BI]
    snap.dailySwapCount = 0
  }
  snap.timestamp = block.timestamp
  snap.blockNumber = block.number
  snap.totalValueLockedUSD = pool.totalValueLockedUSD
  snap.cumulativeVolumeUSD = pool.cumulativeVolumeUSD
  snap.activeLiquidity = pool.activeLiquidity
  snap.tick = pool.tick
  snap.save()
  return snap as LiquidityPoolDailySnapshot
}

export function getOrCreateUsageDaySnapshot(
  block: ethereum.Block
): UsageMetricsDailySnapshot {
  const protocol = getOrCreateProtocol()
  const day = dayId(block.timestamp)
  const id = Bytes.fromI32(day)
  let snap = UsageMetricsDailySnapshot.load(id)
  if (snap == null) {
    snap = new UsageMetricsDailySnapshot(id)
    snap.day = day
    snap.protocol = protocol.id
    snap.dailyActiveUsers = 0
    snap.dailySwapCount = 0
    snap.dailyDepositCount = 0
    snap.dailyWithdrawCount = 0
  }
  snap.timestamp = block.timestamp
  snap.blockNumber = block.number
  snap.cumulativeUniqueUsers = protocol.cumulativeUniqueUsers
  snap.totalPoolCount = protocol.totalPoolCount
  snap.save()
  return snap as UsageMetricsDailySnapshot
}

export function eventPk(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32())
}
