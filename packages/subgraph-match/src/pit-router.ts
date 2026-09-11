import { AgentSwap } from "../generated/PitRouter/PitRouter"
import { Trade } from "../generated/schema"
import { eventId, loadOrCreateAgent, loadOrCreateRound } from "./helpers"

export function handleAgentSwap(event: AgentSwap): void {
  let matchIdStr = event.params.matchId.toString()
  let roundIndex = event.params.round

  // the swap can land before the round-lock event; ensure Round + Agent exist
  let round = loadOrCreateRound(event.params.matchId, roundIndex)
  let agent = loadOrCreateAgent(event.params.agent, event.block.timestamp)

  let trade = new Trade(eventId(event.transaction.hash, event.logIndex))
  trade.match = matchIdStr
  trade.round = round.id
  trade.agent = agent.id
  trade.roundIndex = roundIndex
  trade.amount0 = event.params.amount0
  trade.amount1 = event.params.amount1
  trade.feeAccrued = event.params.feeAccrued
  trade.timestamp = event.block.timestamp
  trade.blockNumber = event.block.number
  trade.tx = event.transaction.hash
  trade.save()
}
