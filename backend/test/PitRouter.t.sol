// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PitTestBase} from "./helpers/PitTestBase.sol";
import {PitRouter} from "../src/PitRouter.sol";
import {MatchController} from "../src/MatchController.sol";

contract PitRouterTest is PitTestBase {
    uint256 internal constant MATCH_ID = 1;

    address internal agentA = makeAddr("agentA");
    address internal agentB = makeAddr("agentB");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        _deployCore();

        _fundAgent(agentA);
        _fundAgent(agentB);

        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));

        // pool.liquidity() == MIN_POOL_LIQUIDITY from the constructor, so the
        // min-depth gate is already satisfied.
        _startMatch(MATCH_ID);
    }

    // ---------------------------------------------------------------- gating

    function test_RevertNotParticipant_UnregisteredCaller() public {
        vm.prank(stranger);
        vm.expectRevert(PitRouter.NotParticipant.selector);
        router.swap(MATCH_ID, true, int256(1_000), 0);
    }

    function test_RevertNotLive_BeforeMatchStarts() public {
        uint256 freshMatch = 2;
        _fundAgent(agentA); // no-op re-approves, harmless
        _register(freshMatch, agentA, "cfgA2", keccak256("saltA2"));
        // freshMatch never had startMatch() called -> status REGISTERING -> not live.

        vm.prank(agentA);
        vm.expectRevert(PitRouter.NotLive.selector);
        router.swap(freshMatch, true, int256(1_000), 0);
    }

    function test_RevertNotLive_OutsideAgentsRegisteredMatch() public {
        // agentA is a participant of MATCH_ID only; matchId 999 doesn't exist at all
        // (defaults to REGISTERING) so currentRoundOf reports not-live regardless.
        vm.prank(agentA);
        vm.expectRevert(PitRouter.NotLive.selector);
        router.swap(999, true, int256(1_000), 0);
    }

    function test_RevertNotLive_AfterMatchElapsed() public {
        uint256 matchLen = uint256(controller.ROUND_COUNT()) * controller.ROUND_SECONDS();
        vm.warp(block.timestamp + matchLen + 1);

        vm.prank(agentA);
        vm.expectRevert(PitRouter.NotLive.selector);
        router.swap(MATCH_ID, true, int256(1_000), 0);
    }

    // ---------------------------------------------------------------- trade cap

    function test_TradeCap_BoundarySucceedsThenExceededReverts() public {
        vm.startPrank(agentA);
        for (uint256 i = 0; i < TRADE_CAP_PER_ROUND; i++) {
            router.swap(MATCH_ID, true, int256(1_000), 0);
        }
        assertEq(router.tradesTaken(MATCH_ID, agentA, 0), TRADE_CAP_PER_ROUND);

        vm.expectRevert(PitRouter.TradeCapExceeded.selector);
        router.swap(MATCH_ID, true, int256(1_000), 0);
        vm.stopPrank();
    }

    function test_TradeCap_ResetsNextRound() public {
        vm.startPrank(agentA);
        for (uint256 i = 0; i < TRADE_CAP_PER_ROUND; i++) {
            router.swap(MATCH_ID, true, int256(1_000), 0);
        }
        vm.expectRevert(PitRouter.TradeCapExceeded.selector);
        router.swap(MATCH_ID, true, int256(1_000), 0);
        vm.stopPrank();

        // Move into round 1 (>= 90s elapsed, still < 540s total match length).
        vm.warp(block.timestamp + controller.ROUND_SECONDS());
        (uint8 round, bool live) = controller.currentRoundOf(MATCH_ID);
        assertTrue(live);
        assertEq(round, 1);

        vm.prank(agentA);
        router.swap(MATCH_ID, true, int256(1_000), 0); // succeeds: cap is per-round
        assertEq(router.tradesTaken(MATCH_ID, agentA, 1), 1);
    }

    function test_TradeCap_IsPerAgentPerRound() public {
        // agentB's cap is independent of agentA's.
        vm.startPrank(agentA);
        for (uint256 i = 0; i < TRADE_CAP_PER_ROUND; i++) {
            router.swap(MATCH_ID, true, int256(1_000), 0);
        }
        vm.stopPrank();

        vm.prank(agentB);
        router.swap(MATCH_ID, true, int256(1_000), 0); // agentB still has full cap available
        assertEq(router.tradesTaken(MATCH_ID, agentB, 0), 1);
    }

    // ---------------------------------------------------------------- swap accounting

    function test_SwapAccounting_ZeroForOne_ExactInput() public {
        int256 amountIn = 1_000_000; // 1 USDC
        uint256 fee = uint256(amountIn) * POOL_FEE / 1_000_000;

        uint256 agentUsdcBefore = usdc.balanceOf(agentA);
        uint256 agentTokBBefore = tokB.balanceOf(agentA);

        vm.expectEmit(true, true, false, true, address(router));
        emit PitRouter.AgentSwap(MATCH_ID, 0, agentA, amountIn, -amountIn, fee);

        vm.prank(agentA);
        (int256 amount0, int256 amount1) = router.swap(MATCH_ID, true, amountIn, 0);

        assertEq(amount0, amountIn, "amount0 should equal the exact-input amount owed to the pool");
        assertEq(amount1, -amountIn, "amount1 should be the negative (paid-out) leg at the 1:1 mock rate");

        assertEq(usdc.balanceOf(agentA), agentUsdcBefore - uint256(amountIn), "agent USDC debited");
        assertEq(tokB.balanceOf(agentA), agentTokBBefore + uint256(amountIn), "agent TOKB credited");

        assertEq(router.feeAccruedByAgent(MATCH_ID, agentA), fee);
        assertEq(router.totalFeeAccrued(MATCH_ID), fee);

        // The router never custodies agent funds.
        assertEq(usdc.balanceOf(address(router)), 0);
        assertEq(tokB.balanceOf(address(router)), 0);
    }

    function test_SwapAccounting_OneForZero_ExactInput() public {
        int256 amountIn = 2_000_000; // 2 TOKB
        uint256 fee = uint256(amountIn) * POOL_FEE / 1_000_000;

        uint256 agentUsdcBefore = usdc.balanceOf(agentA);
        uint256 agentTokBBefore = tokB.balanceOf(agentA);

        vm.prank(agentA);
        (int256 amount0, int256 amount1) = router.swap(MATCH_ID, false, amountIn, 0);

        assertEq(amount1, amountIn, "amount1 should equal the exact-input amount owed to the pool");
        assertEq(amount0, -amountIn, "amount0 should be the negative (paid-out) leg at the 1:1 mock rate");

        assertEq(tokB.balanceOf(agentA), agentTokBBefore - uint256(amountIn), "agent TOKB debited");
        assertEq(usdc.balanceOf(agentA), agentUsdcBefore + uint256(amountIn), "agent USDC credited");

        // _estimateFee reads amount1 (the token1 leg) as amountIn when zeroForOne is false.
        assertEq(router.feeAccruedByAgent(MATCH_ID, agentA), fee);
        assertEq(router.totalFeeAccrued(MATCH_ID), fee);
    }

    function test_SwapAccounting_FeesAccumulateAcrossSwaps() public {
        int256 amountIn = 500_000;
        uint256 feePerSwap = uint256(amountIn) * POOL_FEE / 1_000_000;

        vm.startPrank(agentA);
        router.swap(MATCH_ID, true, amountIn, 0);
        router.swap(MATCH_ID, true, amountIn, 0);
        vm.stopPrank();

        assertEq(router.feeAccruedByAgent(MATCH_ID, agentA), feePerSwap * 2);
        assertEq(router.totalFeeAccrued(MATCH_ID), feePerSwap * 2);

        vm.prank(agentB);
        router.swap(MATCH_ID, true, amountIn, 0);

        // totalFeeAccrued sums across agents; per-agent tracking stays separate.
        assertEq(router.totalFeeAccrued(MATCH_ID), feePerSwap * 3);
        assertEq(router.feeAccruedByAgent(MATCH_ID, agentB), feePerSwap);
        assertEq(router.feeAccruedByAgent(MATCH_ID, agentA), feePerSwap * 2);
    }

    // ---------------------------------------------------------------- callback

    function test_RevertUnauthorizedCallback_DirectCall() public {
        vm.prank(stranger);
        vm.expectRevert(PitRouter.UnauthorizedCallback.selector);
        router.uniswapV3SwapCallback(1, -1, abi.encode(stranger));
    }

    // ---------------------------------------------------------------- constructor

    function test_Constructor_RevertsOnZeroPool() public {
        vm.expectRevert(PitRouter.ZeroAddress.selector);
        new PitRouter(address(0), address(controller), TRADE_CAP_PER_ROUND);
    }

    function test_Constructor_RevertsOnZeroMatchController() public {
        vm.expectRevert(PitRouter.ZeroAddress.selector);
        new PitRouter(address(pool), address(0), TRADE_CAP_PER_ROUND);
    }
}
