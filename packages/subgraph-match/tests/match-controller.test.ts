import { afterEach, assert, clearStore, describe, test } from "matchstick-as"
import {
  handleAgentRegistered,
  handleMatchStarted,
  handleRoundLocked,
  handleStrategyRevealed,
  handleMatchSettled,
  handlePickSubmitted,
} from "../src/match-controller"
import {
  AGENT_A,
  AGENT_B,
  createAgentRegisteredEvent,
  createMatchSettledEvent,
  createMatchStartedEvent,
  createPickSubmittedEvent,
  createRoundLockedEvent,
  createStrategyRevealedEvent,
} from "./helpers"

const COMMIT_A = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const COMMIT_B = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
const STAKE = 1000000 // 1 USDC, 6 decimals — must match helpers.STAKE

describe("handleAgentRegistered", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates Agent + Match + Registration, appends participant", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1))

    assert.entityCount("Agent", 1)
    assert.fieldEquals("Agent", AGENT_A, "totalMatches", "1")
    assert.fieldEquals("Agent", AGENT_A, "wins", "0")

    assert.entityCount("Match", 1)
    assert.fieldEquals("Match", "1", "status", "REGISTERING")
    assert.fieldEquals("Match", "1", "participants", `[${AGENT_A}]`)

    assert.entityCount("Registration", 1)
  })

  test("a second registration adds a second agent to the same match, no duplication", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1, 1000, 0))
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_B, COMMIT_B, STAKE, 1, 1001, 1))

    assert.entityCount("Agent", 2)
    assert.entityCount("Match", 1)
    assert.fieldEquals("Match", "1", "participants", `[${AGENT_A}, ${AGENT_B}]`)
  })
})

describe("handleMatchStarted", () => {
  afterEach(() => {
    clearStore()
  })

  test("flips status to LIVE, records startTime, and stamps the house pool address", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1))
    handleMatchStarted(createMatchStartedEvent(1, 5000, [AGENT_A]))

    assert.fieldEquals("Match", "1", "status", "LIVE")
    assert.fieldEquals("Match", "1", "startTime", "5000")
    // no event carries a pool address (one fixed house pool, v3 pools are
    // their own contract) — the mapping stamps the manifest-level
    // POOL_ADDRESS constant; this is what feeds the Track 1 composition join
    // in graph-client/src/composed.ts.
    assert.fieldEquals("Match", "1", "poolId", "0x46880b404cd35c165eddeff7421019f8dd25f4ad")
  })
})

describe("handleRoundLocked", () => {
  afterEach(() => {
    clearStore()
  })

  test("round 0 of 6 creates Round + RoundLock + AgentResult but leaves the match LIVE", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1))
    handleMatchStarted(createMatchStartedEvent(1, 5000, [AGENT_A]))
    handleRoundLocked(createRoundLockedEvent(1, 0, AGENT_A, 1420000, 5090))

    assert.entityCount("Round", 1)
    assert.fieldEquals("Round", "1-0", "roundIndex", "0")
    assert.fieldEquals("Round", "1-0", "lockedAt", "5090")

    assert.entityCount("RoundLock", 1)
    // Only round 5 (the last of 6) flips the match to LOCKED — round 0 must
    // not, or the board would misreport a match still 5 rounds from done.
    assert.fieldEquals("Match", "1", "status", "LIVE")

    const resultId = "1-" + AGENT_A
    assert.entityCount("AgentResult", 1)
    assert.fieldEquals("AgentResult", resultId, "finalUsdc", "1420000")
    assert.fieldEquals("AgentResult", resultId, "pnl", "420000")
  })

  test("round 5 (the last round) flips the match to LOCKED", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1))
    handleMatchStarted(createMatchStartedEvent(1, 5000, [AGENT_A]))
    handleRoundLocked(createRoundLockedEvent(1, 0, AGENT_A, 1420000, 5090, 0))
    assert.fieldEquals("Match", "1", "status", "LIVE")

    handleRoundLocked(createRoundLockedEvent(1, 5, AGENT_A, 2000000, 5540, 1))
    assert.fieldEquals("Match", "1", "status", "LOCKED")
  })

  test("a later lock in the same round updates finalUsdc/pnl (last lock wins)", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1))
    handleMatchStarted(createMatchStartedEvent(1, 5000, [AGENT_A]))
    handleRoundLocked(createRoundLockedEvent(1, 0, AGENT_A, 1420000, 5090, 0))
    handleRoundLocked(createRoundLockedEvent(1, 1, AGENT_A, 810000, 5180, 1))

    const resultId = "1-" + AGENT_A
    assert.fieldEquals("AgentResult", resultId, "finalUsdc", "810000")
    assert.fieldEquals("AgentResult", resultId, "pnl", "-190000")
    assert.entityCount("Round", 2)
  })
})

describe("handleStrategyRevealed", () => {
  afterEach(() => {
    clearStore()
  })

  test("flips status to REVEALED and creates a StrategyReveal", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1))
    handleStrategyRevealed(createStrategyRevealedEvent(1, AGENT_A, '{"strategy":"momentum"}'))

    assert.fieldEquals("Match", "1", "status", "REVEALED")
    assert.entityCount("StrategyReveal", 1)
  })
})

describe("handleMatchSettled", () => {
  afterEach(() => {
    clearStore()
  })

  test("sets winner + SETTLED, and writes rebate/won per participant in registration order", () => {
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_A, COMMIT_A, STAKE, 1, 1000, 0))
    handleAgentRegistered(createAgentRegisteredEvent(AGENT_B, COMMIT_B, STAKE, 1, 1001, 1))
    handleMatchStarted(createMatchStartedEvent(1, 5000, [AGENT_A, AGENT_B]))
    handleRoundLocked(createRoundLockedEvent(1, 0, AGENT_A, 1420000, 5090, 0))
    handleRoundLocked(createRoundLockedEvent(1, 0, AGENT_B, 810000, 5090, 1))

    handleMatchSettled(createMatchSettledEvent(1, AGENT_A, [12000, 9000]))

    assert.fieldEquals("Match", "1", "status", "SETTLED")
    assert.fieldEquals("Match", "1", "winner", AGENT_A)
    assert.fieldEquals("Agent", AGENT_A, "wins", "1")

    const resA = "1-" + AGENT_A
    const resB = "1-" + AGENT_B
    assert.fieldEquals("AgentResult", resA, "won", "true")
    assert.fieldEquals("AgentResult", resA, "rebate", "12000")
    assert.fieldEquals("AgentResult", resB, "won", "false")
    assert.fieldEquals("AgentResult", resB, "rebate", "9000")
  })

  test("unknown match is a no-op (never throws)", () => {
    handleMatchSettled(createMatchSettledEvent(999, AGENT_A, [1]))
    assert.entityCount("Match", 0)
  })
})

describe("handlePickSubmitted", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates an immutable Pick and touches the Match", () => {
    handlePickSubmitted(createPickSubmittedEvent(1, AGENT_B, AGENT_A))

    assert.entityCount("Pick", 1)
    assert.entityCount("Match", 1)
    assert.fieldEquals("Match", "1", "status", "REGISTERING")
  })
})
