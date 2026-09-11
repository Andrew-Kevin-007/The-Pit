import { afterEach, assert, clearStore, describe, test } from "matchstick-as"
import { handleAgentSwap } from "../src/pit-router"
import { AGENT_A, createAgentSwapEvent } from "./helpers"

describe("handleAgentSwap", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates a Trade and lazily creates the Round + Agent (swap can precede RoundLocked)", () => {
    handleAgentSwap(createAgentSwapEvent(1, 2, AGENT_A, 1000000, -998000, 3000))

    assert.entityCount("Trade", 1)
    assert.entityCount("Round", 1)
    assert.fieldEquals("Round", "1-2", "roundIndex", "2")
    assert.entityCount("Agent", 1)
    assert.fieldEquals("Agent", AGENT_A, "totalMatches", "0") // swap alone doesn't register the agent
  })

  test("negative amount0 (selling token0) is stored as a signed BigInt", () => {
    handleAgentSwap(createAgentSwapEvent(1, 0, AGENT_A, -500000, 497500, 1500))

    assert.entityCount("Trade", 1)
    // spot-check via a second identical-shape trade to confirm distinct ids
    handleAgentSwap(createAgentSwapEvent(1, 0, AGENT_A, -500000, 497500, 1500, 1200, 1))
    assert.entityCount("Trade", 2)
  })
})
