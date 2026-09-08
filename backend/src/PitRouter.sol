// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUniswapV3Pool, IUniswapV3SwapCallback} from "./interfaces/IUniswapV3Pool.sol";
import {IMatchController} from "./interfaces/IMatchController.sol";

/// @title PitRouter
/// @notice The on-chain referee. Wraps a single Uniswap v3 pool's `swap()` and enforces,
///         per docs/README.md's "structurally cannot cheat" claim:
///           1. caller is a registered agent of the match it claims to trade in
///           2. that match's current round is live
///           3. the agent is under its per-round trade cap
///         then forwards to the pool and tracks the swap fee toward the round-rebate.
///         Standard `new PitRouter(...)` / CREATE2 deploy — no address mining, no hook,
///         because v3 has no hook slot; enforcement lives here in the router instead.
contract PitRouter is IUniswapV3SwapCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error NotLive();
    error NotParticipant();
    error TradeCapExceeded();
    error UnauthorizedCallback();
    error ZeroAddress();

    IUniswapV3Pool public immutable pool;
    IMatchController public immutable matchController;
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;
    /// @dev Ceiling enforced on-chain; each agent's own `StrategyConfig.maxTradesPerRound`
    ///      (packages/shared/src/strategyConfig.ts) must self-declare <= this value.
    uint256 public immutable tradeCapPerRound;

    /// matchId => agent => round => trades taken so far this round
    mapping(uint256 => mapping(address => mapping(uint8 => uint256))) public tradesTaken;
    /// matchId => agent => cumulative swap fee this agent generated (input-token terms,
    /// see `_estimateFee`), used by MatchController to compute the settlement rebate split.
    mapping(uint256 => mapping(address => uint256)) public feeAccruedByAgent;
    /// matchId => cumulative fee across all agents, denominator for the rebate split.
    mapping(uint256 => uint256) public totalFeeAccrued;

    event AgentSwap(
        uint256 indexed matchId, uint8 round, address indexed agent, int256 amount0, int256 amount1, uint256 feeAccrued
    );

    constructor(address pool_, address matchController_, uint256 tradeCapPerRound_) {
        if (pool_ == address(0) || matchController_ == address(0)) revert ZeroAddress();
        pool = IUniswapV3Pool(pool_);
        matchController = IMatchController(matchController_);
        token0 = pool.token0();
        token1 = pool.token1();
        fee = pool.fee();
        tradeCapPerRound = tradeCapPerRound_;
    }

    /// @notice Swap through the house pool as a registered, in-round agent.
    /// @dev Output is delivered straight to `msg.sender` (the agent's own wallet) —
    ///      the router never custodies agent funds; input is pulled from the agent
    ///      via `transferFrom` inside `uniswapV3SwapCallback`, so the agent must
    ///      `approve(router, ...)` the input token beforehand.
    function swap(uint256 matchId, bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96)
        external
        nonReentrant
        returns (int256 amount0, int256 amount1)
    {
        (uint8 round, bool live) = matchController.currentRoundOf(matchId);
        if (!live) revert NotLive();
        if (!matchController.isParticipant(matchId, msg.sender)) revert NotParticipant();

        uint256 taken = tradesTaken[matchId][msg.sender][round];
        if (taken >= tradeCapPerRound) revert TradeCapExceeded();
        tradesTaken[matchId][msg.sender][round] = taken + 1;

        (amount0, amount1) = pool.swap(
            msg.sender, zeroForOne, amountSpecified, sqrtPriceLimitX96, abi.encode(msg.sender)
        );

        uint256 feeAccrued = _estimateFee(zeroForOne, amount0, amount1);
        feeAccruedByAgent[matchId][msg.sender] += feeAccrued;
        totalFeeAccrued[matchId] += feeAccrued;

        emit AgentSwap(matchId, round, msg.sender, amount0, amount1, feeAccrued);
    }

    /// @notice Uniswap v3 pool callback — pulls whatever the agent owes the pool.
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external {
        if (msg.sender != address(pool)) revert UnauthorizedCallback();
        address payer = abi.decode(data, (address));

        if (amount0Delta > 0) {
            IERC20(token0).safeTransferFrom(payer, msg.sender, uint256(amount0Delta));
        }
        if (amount1Delta > 0) {
            IERC20(token1).safeTransferFrom(payer, msg.sender, uint256(amount1Delta));
        }
    }

    /// @dev Swap fee is charged on the input leg: `amountIn * fee / 1e6` (fee is in
    ///      hundredths of a bip, e.g. 3000 = 0.30%). The input leg is whichever of
    ///      amount0/amount1 the pool returned positive (what the payer owes).
    function _estimateFee(bool zeroForOne, int256 amount0, int256 amount1) internal view returns (uint256) {
        int256 amountIn = zeroForOne ? amount0 : amount1;
        if (amountIn <= 0) return 0;
        return (uint256(amountIn) * fee) / 1_000_000;
    }
}
