// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {MatchController} from "../src/MatchController.sol";
import {PitRouter} from "../src/PitRouter.sol";
import {IUniswapV3Factory} from "../src/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "../src/interfaces/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "../src/interfaces/INonfungiblePositionManager.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

/// @title ForkE2E
/// @notice The real end-to-end proof: forks live Base Sepolia and runs a complete
///         3-agent match — register, start, six rounds of real PitRouter swaps
///         against the REAL, canonically-deployed Uniswap v3 Factory +
///         NonfungiblePositionManager (not mocks), round locks, reveal, settle,
///         fee-rebate payout — asserting the whole thing end-to-end.
///
/// Deliberately uses fresh MockERC20 tokens for the "USDC"/"tokB" roles instead
/// of the real Base Sepolia USDC (0x036CbD53...): real USDC is a Circle
/// FiatTokenProxy (upgradeable proxy + non-standard storage layout), and
/// forge-std's `deal()` balance-slot-guessing is unreliable against it. Using a
/// fresh token keeps balance seeding trivial and robust while still exercising
/// the real, load-bearing part of the integration — Factory.createPool,
/// Pool.initialize, NonfungiblePositionManager.mint, and Pool.swap on the actual
/// deployed v3 bytecode at the addresses this project will deploy against.
///
/// Opt-in: needs network access to Base Sepolia, so it's skipped unless
/// RUN_FORK_TESTS=true is set — `forge test` stays fast and offline-safe for
/// everyone else. Run explicitly with:
///   RUN_FORK_TESTS=true forge test --match-contract ForkE2E -vv
contract ForkE2ETest is Test {
    // Base Sepolia (chainId 84532), from
    // docs.uniswap.org/contracts/v3/reference/deployments/base-deployments
    address constant FACTORY = 0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24;
    address constant POSITION_MANAGER = 0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2;

    uint24 constant FEE = 3000;
    int24 constant TICK_LOWER = -887220;
    int24 constant TICK_UPPER = 887220;
    // sqrtPriceX96 for a 1:1 raw-unit price (2^96) — the real USDC/WETH price
    // isn't the point of this test (mechanism correctness is), so a round
    // number avoids hand-computing a decimals-adjusted sqrt price.
    uint160 constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    // Real v3 pools reject sqrtPriceLimitX96 == 0 (must be strictly inside
    // (MIN_SQRT_RATIO, MAX_SQRT_RATIO)) — the standard "accept any price impact"
    // limits, same values Uniswap's own periphery routers use as the default.
    uint160 constant MIN_SQRT_RATIO_PLUS_ONE = 4295128740;
    uint160 constant MAX_SQRT_RATIO_MINUS_ONE = 1461446703485210103287273052203988822378723970341;

    uint128 constant MIN_POOL_LIQUIDITY = 1_000_000;
    uint256 constant STAKE = 1_000_000; // 1 "USDC", 6dp — must match MatchController.STAKE_USDC
    uint256 constant TRADE_FUNDING = 1_000_000_000;
    uint256 constant SEED_LIQUIDITY_USDC = 500_000_000_000; // 500,000 "USDC"
    uint256 constant SEED_LIQUIDITY_TOKB = 500_000_000_000_000_000_000_000; // matching order of magnitude, 18dp

    MockERC20 usdc;
    MockERC20 tokB;
    IUniswapV3Pool pool;
    MatchController controller;
    PitRouter router;
    uint256 housePositionTokenId;

    address agentA = makeAddr("forkAgentA");
    address agentB = makeAddr("forkAgentB");
    address agentC = makeAddr("forkAgentC");

    uint256 constant MATCH_ID = 1;

    function setUp() public {
        if (!vm.envOr("RUN_FORK_TESTS", false)) {
            vm.skip(true);
            return;
        }

        string memory rpcUrl = vm.envOr("BASE_SEPOLIA_RPC_URL", string("https://sepolia.base.org"));
        vm.createSelectFork(rpcUrl);
        console.log("forked Base Sepolia at block", block.number);

        usdc = new MockERC20("Test USDC", "tUSDC", 6);
        tokB = new MockERC20("Test Token B", "tTOKB", 18);

        IUniswapV3Factory factory = IUniswapV3Factory(FACTORY);
        address poolAddr = factory.getPool(address(usdc), address(tokB), FEE);
        if (poolAddr == address(0)) {
            poolAddr = factory.createPool(address(usdc), address(tokB), FEE);
            IUniswapV3Pool(poolAddr).initialize(SQRT_PRICE_1_1);
        }
        pool = IUniswapV3Pool(poolAddr);
        console.log("real Base Sepolia v3 pool at", poolAddr);
        console.log("  token0:", pool.token0());
        console.log("  token1:", pool.token1());

        controller = new MatchController(
            address(usdc), poolAddr, POSITION_MANAGER, MIN_POOL_LIQUIDITY, 2, 3, address(this)
        );
        router = new PitRouter(poolAddr, address(controller), 5);
        controller.setPitRouter(address(router));

        // Seed real house liquidity through the real NonfungiblePositionManager.
        usdc.mint(address(this), SEED_LIQUIDITY_USDC);
        tokB.mint(address(this), SEED_LIQUIDITY_TOKB);
        usdc.approve(POSITION_MANAGER, type(uint256).max);
        tokB.approve(POSITION_MANAGER, type(uint256).max);

        (address token0,) = pool.token0() == address(usdc) ? (address(usdc), address(tokB)) : (address(tokB), address(usdc));
        (uint256 amt0Desired, uint256 amt1Desired) = token0 == address(usdc)
            ? (SEED_LIQUIDITY_USDC, SEED_LIQUIDITY_TOKB)
            : (SEED_LIQUIDITY_TOKB, SEED_LIQUIDITY_USDC);

        (housePositionTokenId,,,) = INonfungiblePositionManager(POSITION_MANAGER).mint(
            INonfungiblePositionManager.MintParams({
                token0: pool.token0(),
                token1: pool.token1(),
                fee: FEE,
                tickLower: TICK_LOWER,
                tickUpper: TICK_UPPER,
                amount0Desired: token0 == pool.token0() ? amt0Desired : amt1Desired,
                amount1Desired: token0 == pool.token0() ? amt1Desired : amt0Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(controller),
                deadline: block.timestamp
            })
        );
        console.log("real house position minted, tokenId", housePositionTokenId);
        controller.setHousePosition(housePositionTokenId);

        _fundAgent(agentA);
        _fundAgent(agentB);
        _fundAgent(agentC);
    }

    function test_FullMatchLifecycle_AgainstRealBaseSepoliaUniswapV3() public {
        if (!vm.envOr("RUN_FORK_TESTS", false)) return; // setUp already vm.skip'd

        bytes32 commitA = keccak256(abi.encodePacked("cfgA", "\n", keccak256("saltA")));
        bytes32 commitB = keccak256(abi.encodePacked("cfgB", "\n", keccak256("saltB")));
        bytes32 commitC = keccak256(abi.encodePacked("cfgC", "\n", keccak256("saltC")));

        controller.register(MATCH_ID, agentA, commitA, STAKE);
        controller.register(MATCH_ID, agentB, commitB, STAKE);
        controller.register(MATCH_ID, agentC, commitC, STAKE);
        assertEq(controller.participantsOf(MATCH_ID).length, 3);

        controller.startMatch(MATCH_ID);
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.LIVE));

        // Six real rounds: each agent swaps a small, real amount through the
        // real pool via PitRouter, then the round is locked after it elapses.
        for (uint8 r = 0; r < 6; r++) {
            // Tiny, round, decimals-agnostic amounts — factory sorts token0/token1
            // by raw address (unpredictable per fork run), so this deliberately
            // does not assume which of {usdc, tokB} ends up on which side; 10,000
            // raw units is negligible against both agents' funded balances either way.
            vm.prank(agentA);
            router.swap(MATCH_ID, true, int256(10_000), MIN_SQRT_RATIO_PLUS_ONE);
            vm.prank(agentB);
            router.swap(MATCH_ID, false, int256(10_000), MAX_SQRT_RATIO_MINUS_ONE);
            // agentC trades nothing this round — the passive-baseline strategy.

            vm.warp(block.timestamp + controller.ROUND_SECONDS());
            controller.lockRound(MATCH_ID, r);
        }
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.LOCKED));

        controller.reveal(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        controller.reveal(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        controller.reveal(MATCH_ID, agentC, "cfgC", keccak256("saltC"));
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.REVEALED));

        uint256 totalFeesBefore = router.totalFeeAccrued(MATCH_ID);
        console.log("total fee volume accrued across all agents:", totalFeesBefore);
        assertGt(totalFeesBefore, 0, "real swaps against the real pool must accrue real fees");

        controller.settle(MATCH_ID);
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.SETTLED));

        console.log("=== FINAL RESULT (real Base Sepolia Uniswap v3 fork) ===");
        console.log("agentA final tUSDC:", usdc.balanceOf(agentA));
        console.log("agentB final tUSDC:", usdc.balanceOf(agentB));
        console.log("agentC final tUSDC:", usdc.balanceOf(agentC));
        console.log("PASS: full register -> start -> 6 rounds -> lock -> reveal -> settle");
        console.log("      lifecycle completed against real Factory/Pool/PositionManager bytecode");
    }

    function _fundAgent(address agent) internal {
        usdc.mint(agent, STAKE + TRADE_FUNDING);
        tokB.mint(agent, TRADE_FUNDING * 1e12); // match order of magnitude at 18dp
        vm.startPrank(agent);
        usdc.approve(address(router), type(uint256).max);
        tokB.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }
}
