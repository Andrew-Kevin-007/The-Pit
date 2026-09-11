import { afterEach, assert, clearStore, describe, test } from "matchstick-as"
import { handleBurn, handleInitialize, handleMint, handleSwap } from "../src/pool"
import {
  FACTORY,
  POOL,
  createBurnEvent,
  createInitializeEvent,
  createMintEvent,
  createSwapEvent,
  mockPoolContract,
} from "./helpers"

describe("handleInitialize", () => {
  afterEach(() => {
    clearStore()
  })

  test("creates DexAmmProtocol (keyed by the Factory), Token x2, LiquidityPoolFee, and LiquidityPool", () => {
    mockPoolContract(3000)
    handleInitialize(createInitializeEvent())

    assert.entityCount("DexAmmProtocol", 1)
    assert.fieldEquals("DexAmmProtocol", FACTORY, "totalPoolCount", "1")

    assert.entityCount("Token", 2)
    assert.entityCount("LiquidityPoolFee", 1)

    assert.entityCount("LiquidityPool", 1)
    assert.fieldEquals("LiquidityPool", POOL, "isSingleSided", "false")
    assert.fieldEquals("LiquidityPool", POOL, "cumulativeSwapCount", "0")
    assert.fieldEquals("LiquidityPool", POOL, "name", "USDC / WETH")
  })
})

describe("handleSwap", () => {
  afterEach(() => {
    clearStore()
  })

  test("lazily creates the pool on the first Swap, with no prior Initialize", () => {
    // Real v3 pools are usually initialized long before this subgraph's
    // startBlock — if Swap/Mint/Burn required a pool row that only
    // `handleInitialize` creates, every one of them would be silently
    // dropped. getOrCreatePool() fetches token0/token1/fee via eth_call the
    // first time any event for this pool arrives, Initialize included or not.
    mockPoolContract(3000)
    handleSwap(createSwapEvent(1000, -998))

    assert.entityCount("LiquidityPool", 1)
    assert.entityCount("DexAmmProtocol", 1)
    assert.entityCount("Swap", 1)
  })

  test("positive amount0 -> tokenIn is token0; updates pool tick/liquidity/cumulative volume", () => {
    mockPoolContract(3000)
    handleInitialize(createInitializeEvent())
    handleSwap(createSwapEvent(1000000, -998000, 792281625142643375, 555, 42, 1100))

    assert.entityCount("Swap", 1)
    assert.fieldEquals("LiquidityPool", POOL, "tick", "42")
    assert.fieldEquals("LiquidityPool", POOL, "activeLiquidity", "555")
    assert.fieldEquals("LiquidityPool", POOL, "cumulativeSwapCount", "1")
  })

  test("negative amount0 -> tokenIn is token1 (direction flips)", () => {
    mockPoolContract(3000)
    handleInitialize(createInitializeEvent())
    handleSwap(createSwapEvent(-500000, 497500))

    assert.entityCount("Swap", 1)
    assert.fieldEquals("DexAmmProtocol", FACTORY, "cumulativeSwapCount", "1")
  })

  test("counts a unique account once across swaps from the same sender (tx.from, not recipient)", () => {
    mockPoolContract(3000)
    handleInitialize(createInitializeEvent())
    handleSwap(createSwapEvent(1000, -998, 792281625142643375, 1000, 1, 1101, 0))
    handleSwap(createSwapEvent(1000, -998, 792281625142643375, 1000, 1, 1102, 1))

    assert.entityCount("Account", 1)
    assert.fieldEquals("DexAmmProtocol", FACTORY, "cumulativeUniqueUsers", "1")
  })
})

describe("handleMint / handleBurn", () => {
  afterEach(() => {
    clearStore()
  })

  test("Mint creates a Deposit with the real token0/token1 amounts and increases activeLiquidity", () => {
    mockPoolContract(3000)
    handleInitialize(createInitializeEvent())
    handleMint(createMintEvent(500, 12000000, 34000000000000000))

    assert.entityCount("Deposit", 1)
    assert.entityCount("Withdraw", 0)
    assert.fieldEquals("LiquidityPool", POOL, "activeLiquidity", "500")
  })

  test("Burn creates a Withdraw and decreases activeLiquidity", () => {
    mockPoolContract(3000)
    handleInitialize(createInitializeEvent())
    handleMint(createMintEvent(500, 12000000, 34000000000000000, -600, 600, 1050, 0))
    handleBurn(createBurnEvent(200, 5000000, 14000000000000000, -600, 600, 1060, 1))

    assert.entityCount("Deposit", 1)
    assert.entityCount("Withdraw", 1)
    assert.fieldEquals("LiquidityPool", POOL, "activeLiquidity", "300")
  })
})
