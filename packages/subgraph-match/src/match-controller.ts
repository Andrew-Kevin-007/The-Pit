import { BigInt } from "@graphprotocol/graph-ts"
import {
  AgentRegistered,
  MatchStarted,
  RoundLocked,
  StrategyRevealed,
  MatchSettled,
  PickSubmitted,
} from "../generated/MatchController/MatchController"
import {
  Match,
  Registration,
  RoundLock,
  StrategyReveal,
  AgentResult,
  Pick,
} from "../generated/schema"
import {
  POOL_ADDRESS,
  STAKE,
  eventId,
  resultId,
  loadOrCreateAgent,
  loadOrCreateMatch,
  loadOrCreateRound,
} from "./helpers"

export function handleAgentRegistered(event: AgentRegistered): void {
  let ts = event.block.timestamp
  let agent = loadOrCreateAgent(event.params.agent, ts)
  let m = loadOrCreateMatch(event.params.matchId, ts, event.transaction.hash)

  let participants = m.participants
  participants.push(agent.id)
  m.participants = participants
  m.save()

  agent.totalMatches = agent.totalMatches + 1
  agent.save()

  let reg = new Registration(eventId(event.transaction.hash, event.logIndex))
  reg.match = m.id
  reg.agent = agent.id
  reg.commitHash = event.params.commitHash
  reg.stake = event.params.stake
  reg.timestamp = ts
  reg.tx = event.transaction.hash
  reg.save()
}

export function handleMatchStarted(event: MatchStarted): void {
  let m = loadOrCreateMatch(
    event.params.matchId,
    event.block.timestamp,
    event.transaction.hash
  )
  m.status = "LIVE"
  m.startTime = event.params.startTime
  // no event carries a pool address (one fixed house pool) — see helpers.POOL_ADDRESS
  m.poolId = POOL_ADDRESS
  m.save()
}

export function handleRoundLocked(event: RoundLocked): void {
  let matchIdStr = event.params.matchId.toString()
  let roundIndex = event.params.round
  let round = loadOrCreateRound(event.params.matchId, roundIndex)
  round.lockedAt = event.params.timestamp
  round.save()

  // Only the LAST round's lock actually means the match is done — RoundLocked
  // fires once per agent per round, so this handler runs 6x (rounds) * N
  // (agents) times per match. Setting status on every call would flip the
  // board to "LOCKED" from round 0 onward, misreporting a still-live match.
  if (roundIndex == 5) {
    let m = Match.load(matchIdStr)
    if (m != null) {
      m.status = "LOCKED"
      m.save()
    }
  }

  let agent = loadOrCreateAgent(event.params.agent, event.block.timestamp)

  let lock = new RoundLock(eventId(event.transaction.hash, event.logIndex))
  lock.round = round.id
  lock.match = matchIdStr
  lock.agent = agent.id
  lock.usdcBalance = event.params.usdcBalance
  lock.timestamp = event.params.timestamp
  lock.tx = event.transaction.hash
  lock.save()

  // running result row — last lock wins
  let rId = resultId(matchIdStr, agent.id)
  let res = AgentResult.load(rId)
  if (res == null) {
    res = new AgentResult(rId)
    res.match = matchIdStr
    res.agent = agent.id
    res.rebate = BigInt.zero()
    res.won = false
  }
  res.finalUsdc = event.params.usdcBalance
  res.pnl = event.params.usdcBalance.minus(STAKE)
  res.save()
}

export function handleStrategyRevealed(event: StrategyRevealed): void {
  let matchIdStr = event.params.matchId.toString()
  let m = Match.load(matchIdStr)
  if (m != null) {
    m.status = "REVEALED"
    m.save()
  }

  let agent = loadOrCreateAgent(event.params.agent, event.block.timestamp)

  let reveal = new StrategyReveal(
    eventId(event.transaction.hash, event.logIndex)
  )
  reveal.match = matchIdStr
  reveal.agent = agent.id
  reveal.config = event.params.config
  reveal.timestamp = event.block.timestamp
  reveal.tx = event.transaction.hash
  reveal.save()
}

export function handleMatchSettled(event: MatchSettled): void {
  let matchIdStr = event.params.matchId.toString()
  let m = Match.load(matchIdStr)
  if (m == null) return

  m.status = "SETTLED"
  m.settledAt = event.block.timestamp

  let winner = loadOrCreateAgent(event.params.winner, event.block.timestamp)
  m.winner = winner.id
  m.save()

  winner.wins = winner.wins + 1
  winner.save()

  // rebateAmounts is index-aligned with m.participants
  let participants = m.participants
  let rebates = event.params.rebateAmounts
  for (let i = 0; i < participants.length; i++) {
    let agentId = participants[i]
    let rId = resultId(matchIdStr, agentId)
    let res = AgentResult.load(rId)
    if (res == null) {
      res = new AgentResult(rId)
      res.match = matchIdStr
      res.agent = agentId
      res.finalUsdc = BigInt.zero()
      res.pnl = BigInt.zero().minus(STAKE)
    }
    res.rebate = i < rebates.length ? rebates[i] : BigInt.zero()
    res.won = agentId == winner.id
    res.save()
  }
}

export function handlePickSubmitted(event: PickSubmitted): void {
  let matchIdStr = event.params.matchId.toString()
  loadOrCreateMatch(
    event.params.matchId,
    event.block.timestamp,
    event.transaction.hash
  )

  let pick = new Pick(eventId(event.transaction.hash, event.logIndex))
  pick.match = matchIdStr
  pick.spectator = event.params.spectator
  pick.side = event.params.side
  pick.timestamp = event.block.timestamp
  pick.save()
}
