import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts"
import { Agent, Match, Round } from "../generated/schema"

// Fixed $1 USDC stake (6 decimals) — must match backend/src/MatchController.sol
// STAKE_USDC. Update if the match format changes.
export const STAKE: BigInt = BigInt.fromI32(1).times(
  BigInt.fromI32(10).pow(6 as u8)
)

// The house pool every match trades on (PitRouter's immutable `pool`, a v3
// pool contract address — no event carries it). Phase 1 is ONE fixed format,
// ONE house-seeded pool, so this is a manifest-level constant, not something
// read off an event. Stamped onto Match.poolId in handleMatchStarted — that's
// what lights up the Track 1 composition (@the-pit/graph-client composed.ts
// joins on Match.poolId). Real Base Sepolia USDC/WETH 0.3% pool, deployed
// 2026-09-12 (backend/script/Deploy.s.sol) — same pool
// @the-pit/subgraph-messari already indexes. See docs/HANDOFF-KEVIN.md §6.
export const POOL_ADDRESS: Bytes = Bytes.fromHexString(
  "0x46880b404CD35c165EDdefF7421019F8dD25F4Ad"
)

export function eventId(txHash: Bytes, logIndex: BigInt): Bytes {
  return txHash.concatI32(logIndex.toI32())
}

export function roundId(matchId: BigInt, roundIndex: i32): string {
  return matchId.toString() + "-" + BigInt.fromI32(roundIndex).toString()
}

export function resultId(matchId: string, agent: Bytes): string {
  return matchId + "-" + agent.toHexString()
}

export function loadOrCreateAgent(addr: Address, ts: BigInt): Agent {
  let agent = Agent.load(addr)
  if (agent == null) {
    agent = new Agent(addr)
    agent.firstSeen = ts
    agent.totalMatches = 0
    agent.wins = 0
    agent.save()
  }
  return agent as Agent
}

export function loadOrCreateMatch(
  matchId: BigInt,
  ts: BigInt,
  tx: Bytes
): Match {
  let id = matchId.toString()
  let m = Match.load(id)
  if (m == null) {
    m = new Match(id)
    m.status = "REGISTERING"
    m.participants = []
    m.createdAt = ts
    m.createdTx = tx
    m.save()
  }
  return m as Match
}

export function loadOrCreateRound(
  matchId: BigInt,
  roundIndex: i32
): Round {
  let id = roundId(matchId, roundIndex)
  let round = Round.load(id)
  if (round == null) {
    round = new Round(id)
    round.match = matchId.toString()
    round.roundIndex = roundIndex
    round.save()
  }
  return round as Round
}
