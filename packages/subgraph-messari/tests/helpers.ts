import { createMockedFunction, dataSourceMock, newMockEvent } from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import { Initialize, Mint, Burn, Swap } from "../generated/UniswapV3Pool/UniswapV3Pool"

export const FACTORY = "0x4752ba5dbc23f44d87826276bf6fd6b1c372ad24"
export const POOL = "0x46880b404cd35c165eddeff7421019f8dd25f4ad"
export const TOKEN0 = "0x036cbd53842c5426634e7929541ec2318f3dcf7e" // USDC
export const TOKEN1 = "0x4200000000000000000000000000000000000006" // WETH
export const SENDER = "0x9999999999999999999999999999999999999999"
export const RECIPIENT = "0x8888888888888888888888888888888888888888"

/** mocks token0()/token1()/fee() on the pool — the manifest's declared calls */
export function mockPoolContract(fee: i32 = 3000): void {
  createMockedFunction(Address.fromString(POOL), "token0", "token0():(address)")
    .returns([ethereum.Value.fromAddress(Address.fromString(TOKEN0))])
  createMockedFunction(Address.fromString(POOL), "token1", "token1():(address)")
    .returns([ethereum.Value.fromAddress(Address.fromString(TOKEN1))])
  createMockedFunction(Address.fromString(POOL), "fee", "fee():(uint24)")
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(fee))])
}

function baseEvent(ts: i32, blockNumber: i32, txHash: string, logIndex: i32): ethereum.Event {
  // dataSource.address() isn't used directly by src/pool.ts (it reads
  // event.address instead), but pin it anyway for parity with subgraph-match.
  dataSourceMock.setAddress(POOL)
  let event = newMockEvent()
  event.address = Address.fromString(POOL)
  event.block.timestamp = BigInt.fromI32(ts)
  event.block.number = BigInt.fromI32(blockNumber)
  event.transaction.hash = Bytes.fromHexString(txHash)
  event.transaction.from = Address.fromString(SENDER)
  event.logIndex = BigInt.fromI32(logIndex)
  event.parameters = new Array()
  return event
}

export function createInitializeEvent(
  sqrtPriceX96: i64 = 792281625142643375,
  tick: i32 = 0,
  ts: i32 = 1000,
  logIndex: i32 = 0
): Initialize {
  let event = changetype<Initialize>(
    baseEvent(ts, 1, "0x000000000000000000000000000000000000000000000000000000000000aaaa", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("sqrtPriceX96", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(sqrtPriceX96))))
  event.parameters.push(new ethereum.EventParam("tick", ethereum.Value.fromSignedBigInt(BigInt.fromI32(tick))))
  return event
}

export function createSwapEvent(
  amount0: i64,
  amount1: i64,
  sqrtPriceX96: i64 = 792281625142643375,
  liquidity: i64 = 1000000000000,
  tick: i32 = 10,
  ts: i32 = 1100,
  logIndex: i32 = 0
): Swap {
  let event = changetype<Swap>(
    baseEvent(ts, 2, "0x000000000000000000000000000000000000000000000000000000000000bbbb", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("sender", ethereum.Value.fromAddress(Address.fromString(SENDER))))
  event.parameters.push(new ethereum.EventParam("recipient", ethereum.Value.fromAddress(Address.fromString(RECIPIENT))))
  event.parameters.push(new ethereum.EventParam("amount0", ethereum.Value.fromSignedBigInt(BigInt.fromI64(amount0))))
  event.parameters.push(new ethereum.EventParam("amount1", ethereum.Value.fromSignedBigInt(BigInt.fromI64(amount1))))
  event.parameters.push(new ethereum.EventParam("sqrtPriceX96", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(sqrtPriceX96))))
  event.parameters.push(new ethereum.EventParam("liquidity", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(liquidity))))
  event.parameters.push(new ethereum.EventParam("tick", ethereum.Value.fromSignedBigInt(BigInt.fromI32(tick))))
  return event
}

export function createMintEvent(
  amount: i64,
  amount0: i64,
  amount1: i64,
  tickLower: i32 = -600,
  tickUpper: i32 = 600,
  ts: i32 = 1050,
  logIndex: i32 = 0
): Mint {
  let event = changetype<Mint>(
    baseEvent(ts, 1, "0x000000000000000000000000000000000000000000000000000000000000cccc", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("sender", ethereum.Value.fromAddress(Address.fromString(SENDER))))
  event.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(Address.fromString(RECIPIENT))))
  event.parameters.push(new ethereum.EventParam("tickLower", ethereum.Value.fromSignedBigInt(BigInt.fromI32(tickLower))))
  event.parameters.push(new ethereum.EventParam("tickUpper", ethereum.Value.fromSignedBigInt(BigInt.fromI32(tickUpper))))
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount))))
  event.parameters.push(new ethereum.EventParam("amount0", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount0))))
  event.parameters.push(new ethereum.EventParam("amount1", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount1))))
  return event
}

export function createBurnEvent(
  amount: i64,
  amount0: i64,
  amount1: i64,
  tickLower: i32 = -600,
  tickUpper: i32 = 600,
  ts: i32 = 1060,
  logIndex: i32 = 0
): Burn {
  let event = changetype<Burn>(
    baseEvent(ts, 1, "0x000000000000000000000000000000000000000000000000000000000000dddd", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("owner", ethereum.Value.fromAddress(Address.fromString(RECIPIENT))))
  event.parameters.push(new ethereum.EventParam("tickLower", ethereum.Value.fromSignedBigInt(BigInt.fromI32(tickLower))))
  event.parameters.push(new ethereum.EventParam("tickUpper", ethereum.Value.fromSignedBigInt(BigInt.fromI32(tickUpper))))
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount))))
  event.parameters.push(new ethereum.EventParam("amount0", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount0))))
  event.parameters.push(new ethereum.EventParam("amount1", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(amount1))))
  return event
}
