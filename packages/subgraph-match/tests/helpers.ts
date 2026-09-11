import { newMockEvent } from "matchstick-as"
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts"
import {
  AgentRegistered,
  MatchStarted,
  RoundLocked,
  StrategyRevealed,
  MatchSettled,
  PickSubmitted,
} from "../generated/MatchController/MatchController"
import { AgentSwap } from "../generated/PitRouter/PitRouter"

export const AGENT_A = "0x1111111111111111111111111111111111111111"
export const AGENT_B = "0x2222222222222222222222222222222222222222"
export const WINNER = AGENT_A

function baseEvent(
  address: string,
  ts: i32,
  blockNumber: i32,
  txHash: string,
  logIndex: i32
): ethereum.Event {
  let event = newMockEvent()
  event.address = Address.fromString(address)
  event.block.timestamp = BigInt.fromI32(ts)
  event.block.number = BigInt.fromI32(blockNumber)
  event.transaction.hash = Bytes.fromHexString(txHash)
  event.logIndex = BigInt.fromI32(logIndex)
  event.parameters = new Array()
  return event
}

const MATCH_CONTROLLER = "0x000000c0e7a011000000000000000000000000cc"
const PIT_ROUTER = "0x0000000000000000000000000000000000000ee0"

export function createAgentRegisteredEvent(
  agent: string,
  commitHash: string,
  stake: i32,
  matchId: i32,
  ts: i32 = 1000,
  logIndex: i32 = 0
): AgentRegistered {
  let event = changetype<AgentRegistered>(
    baseEvent(MATCH_CONTROLLER, ts, 1, "0x000000000000000000000000000000000000000000000000000000000000aaaa", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("agent", ethereum.Value.fromAddress(Address.fromString(agent))))
  event.parameters.push(new ethereum.EventParam("commitHash", ethereum.Value.fromFixedBytes(Bytes.fromHexString(commitHash))))
  event.parameters.push(new ethereum.EventParam("stake", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(stake))))
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  return event
}

export function createMatchStartedEvent(
  matchId: i32,
  startTime: i32,
  agents: Array<string>,
  ts: i32 = 1000,
  logIndex: i32 = 0
): MatchStarted {
  let event = changetype<MatchStarted>(
    baseEvent(MATCH_CONTROLLER, ts, 1, "0x000000000000000000000000000000000000000000000000000000000000bbbb", logIndex)
  )
  let addrs = new Array<Address>()
  for (let i = 0; i < agents.length; i++) addrs.push(Address.fromString(agents[i]))
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  event.parameters.push(new ethereum.EventParam("startTime", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(startTime))))
  event.parameters.push(new ethereum.EventParam("agents", ethereum.Value.fromAddressArray(addrs)))
  return event
}

export function createRoundLockedEvent(
  matchId: i32,
  round: i32,
  agent: string,
  usdcBalance: i64,
  timestamp: i32,
  logIndex: i32 = 0
): RoundLocked {
  let event = changetype<RoundLocked>(
    baseEvent(MATCH_CONTROLLER, timestamp, 2, "0x000000000000000000000000000000000000000000000000000000000000cccc", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  event.parameters.push(new ethereum.EventParam("round", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(round))))
  event.parameters.push(new ethereum.EventParam("agent", ethereum.Value.fromAddress(Address.fromString(agent))))
  event.parameters.push(new ethereum.EventParam("usdcBalance", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(usdcBalance))))
  event.parameters.push(new ethereum.EventParam("timestamp", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(timestamp))))
  return event
}

export function createStrategyRevealedEvent(
  matchId: i32,
  agent: string,
  config: string,
  ts: i32 = 2000,
  logIndex: i32 = 0
): StrategyRevealed {
  let event = changetype<StrategyRevealed>(
    baseEvent(MATCH_CONTROLLER, ts, 3, "0x000000000000000000000000000000000000000000000000000000000000dddd", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  event.parameters.push(new ethereum.EventParam("agent", ethereum.Value.fromAddress(Address.fromString(agent))))
  event.parameters.push(new ethereum.EventParam("config", ethereum.Value.fromString(config)))
  return event
}

export function createMatchSettledEvent(
  matchId: i32,
  winner: string,
  rebateAmounts: Array<i64>,
  ts: i32 = 2100,
  logIndex: i32 = 0
): MatchSettled {
  let event = changetype<MatchSettled>(
    baseEvent(MATCH_CONTROLLER, ts, 4, "0x000000000000000000000000000000000000000000000000000000000000eeee", logIndex)
  )
  let amounts = new Array<BigInt>()
  for (let i = 0; i < rebateAmounts.length; i++) amounts.push(BigInt.fromI64(rebateAmounts[i]))
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  event.parameters.push(new ethereum.EventParam("winner", ethereum.Value.fromAddress(Address.fromString(winner))))
  event.parameters.push(new ethereum.EventParam("rebateAmounts", ethereum.Value.fromUnsignedBigIntArray(amounts)))
  return event
}

export function createPickSubmittedEvent(
  matchId: i32,
  spectator: string,
  side: string,
  ts: i32 = 1500,
  logIndex: i32 = 0
): PickSubmitted {
  let event = changetype<PickSubmitted>(
    baseEvent(MATCH_CONTROLLER, ts, 2, "0x000000000000000000000000000000000000000000000000000000000000ffff", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  event.parameters.push(new ethereum.EventParam("spectator", ethereum.Value.fromAddress(Address.fromString(spectator))))
  event.parameters.push(new ethereum.EventParam("side", ethereum.Value.fromAddress(Address.fromString(side))))
  return event
}

export function createAgentSwapEvent(
  matchId: i32,
  round: i32,
  agent: string,
  amount0: i64,
  amount1: i64,
  feeAccrued: i64,
  ts: i32 = 1200,
  logIndex: i32 = 0
): AgentSwap {
  let event = changetype<AgentSwap>(
    baseEvent(PIT_ROUTER, ts, 2, "0x000000000000000000000000000000000000000000000000000000000000abab", logIndex)
  )
  event.parameters.push(new ethereum.EventParam("matchId", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(matchId))))
  event.parameters.push(new ethereum.EventParam("round", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(round))))
  event.parameters.push(new ethereum.EventParam("agent", ethereum.Value.fromAddress(Address.fromString(agent))))
  event.parameters.push(new ethereum.EventParam("amount0", ethereum.Value.fromSignedBigInt(BigInt.fromI64(amount0))))
  event.parameters.push(new ethereum.EventParam("amount1", ethereum.Value.fromSignedBigInt(BigInt.fromI64(amount1))))
  event.parameters.push(new ethereum.EventParam("feeAccrued", ethereum.Value.fromUnsignedBigInt(BigInt.fromI64(feeAccrued))))
  return event
}
