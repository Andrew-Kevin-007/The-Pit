// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockUniswapV3Pool} from "../mocks/MockUniswapV3Pool.sol";
import {MockPositionManager} from "../mocks/MockPositionManager.sol";
import {MatchController} from "../../src/MatchController.sol";
import {PitRouter} from "../../src/PitRouter.sol";

/// @notice Shared deploy/setup scaffolding for PitRouter.t.sol and MatchController.t.sol —
///         both suites drive the same real MatchController + PitRouter against the same
///         three mocks (MockERC20 x2, MockUniswapV3Pool, MockPositionManager), so the
///         wiring lives here once.
abstract contract PitTestBase is Test {
    MockERC20 internal usdc;
    MockERC20 internal tokB;
    MockUniswapV3Pool internal pool;
    MockPositionManager internal posManager;
    MatchController internal controller;
    PitRouter internal router;

    address internal operator = makeAddr("operator");

    uint24 internal constant POOL_FEE = 3000; // 0.3%
    uint128 internal constant MIN_POOL_LIQUIDITY = 1_000_000;
    uint256 internal constant MIN_AGENTS = 2;
    uint256 internal constant MAX_AGENTS = 4;
    uint256 internal constant TRADE_CAP_PER_ROUND = 3;

    uint256 internal constant STAKE = 1_000_000; // 1 USDC, 6dp — must match MatchController.STAKE_USDC
    uint256 internal constant TRADE_FUNDING = 1_000_000_000; // 1,000 USDC, 6dp, for swap-input headroom
    uint256 internal constant POOL_FUNDING = 1_000_000_000_000; // deep two-sided liquidity so the pool can pay out either leg

    function _deployCore() internal {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        tokB = new MockERC20("Token B", "TOKB", 18);

        // USDC as token0, TOKB as token1 — MatchController only requires one leg be USDC.
        pool = new MockUniswapV3Pool(address(usdc), address(tokB), POOL_FEE, MIN_POOL_LIQUIDITY);
        posManager = new MockPositionManager(address(usdc), address(tokB));

        controller = new MatchController(
            address(usdc), address(pool), address(posManager), MIN_POOL_LIQUIDITY, MIN_AGENTS, MAX_AGENTS, operator
        );

        router = new PitRouter(address(pool), address(controller), TRADE_CAP_PER_ROUND);

        vm.prank(operator);
        controller.setPitRouter(address(router));

        // Fund the pool with the output-side token so it can pay out `zeroForOne` swaps.
        tokB.mint(address(pool), POOL_FUNDING);
        // ...and with USDC so it can pay out `!zeroForOne` swaps too.
        usdc.mint(address(pool), POOL_FUNDING);
    }

    /// @dev Mints stake + trading headroom to `agent` and pre-approves both the
    ///      controller (for the stake pull) and the router (for swap inputs).
    function _fundAgent(address agent) internal {
        usdc.mint(agent, STAKE + TRADE_FUNDING);
        tokB.mint(agent, TRADE_FUNDING);

        vm.startPrank(agent);
        usdc.approve(address(controller), type(uint256).max);
        usdc.approve(address(router), type(uint256).max);
        tokB.approve(address(router), type(uint256).max);
        vm.stopPrank();
    }

    function _commitHash(string memory config, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(config, "\n", salt));
    }

    function _register(uint256 matchId, address agent, string memory config, bytes32 salt) internal {
        bytes32 h = _commitHash(config, salt);
        vm.prank(operator);
        controller.register(matchId, agent, h, STAKE);
    }

    function _startMatch(uint256 matchId) internal {
        vm.prank(operator);
        controller.startMatch(matchId);
    }

    /// @dev lockRound() now enforces that each round's 90s window has actually
    ///      elapsed (RoundNotElapsed) — warp forward one ROUND_SECONDS before
    ///      each lock so this helper still lands exactly on each round boundary.
    function _lockAllRounds(uint256 matchId) internal {
        for (uint8 r = 0; r < controller.ROUND_COUNT(); r++) {
            vm.warp(block.timestamp + controller.ROUND_SECONDS());
            vm.prank(operator);
            controller.lockRound(matchId, r);
        }
    }

    function _revealAll(uint256 matchId, address[] memory agents, string[] memory configs, bytes32[] memory salts)
        internal
    {
        for (uint256 i = 0; i < agents.length; i++) {
            vm.prank(operator);
            controller.reveal(matchId, agents[i], configs[i], salts[i]);
        }
    }
}
