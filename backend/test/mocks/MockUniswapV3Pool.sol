// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV3Pool, IUniswapV3SwapCallback} from "../../src/interfaces/IUniswapV3Pool.sol";

/// @notice Just enough of a Uniswap v3 pool to drive PitRouter/MatchController tests:
///         fixed token0/token1/fee, a test-settable `liquidity()`, and a `swap()` that
///         moves real MockERC20 balances at a trivial 1:1 rate while reproducing v3's
///         optimistic-transfer-then-callback sequencing and signed-delta conventions
///         closely enough to exercise PitRouter's accounting. No tick math, no price
///         limit enforcement — sqrtPriceLimitX96 is accepted and ignored.
contract MockUniswapV3Pool is IUniswapV3Pool {
    address public immutable token0;
    address public immutable token1;
    uint24 public immutable fee;

    uint128 private _liquidity;

    constructor(address token0_, address token1_, uint24 fee_, uint128 liquidity_) {
        token0 = token0_;
        token1 = token1_;
        fee = fee_;
        _liquidity = liquidity_;
    }

    /// @notice Test-only setter so PoolTooShallow can be exercised both ways.
    function setLiquidity(uint128 liquidity_) external {
        _liquidity = liquidity_;
    }

    /// @dev No-op — this mock is always "initialized"; real pools require this
    ///      once, right after Factory.createPool(), before any mint/swap.
    function initialize(uint160) external {}

    function liquidity() external view returns (uint128) {
        return _liquidity;
    }

    function slot0()
        external
        pure
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        )
    {
        // Not read by PitRouter/MatchController; fixed dummy values are enough to
        // satisfy the interface.
        return (0, 0, 0, 0, 0, 0, true);
    }

    /// @dev 1:1 fixed-rate swap. `amountSpecified > 0` is exact-input (that leg is
    ///      positive/owed-to-pool), `< 0` is exact-output (the other leg is negative/
    ///      the specified-output leg). Signs follow real v3: positive = pool receives
    ///      (payer owes it), negative = pool pays out (recipient receives it).
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160, /* sqrtPriceLimitX96 */
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1) {
        require(amountSpecified != 0, "AS");
        bool exactInput = amountSpecified > 0;

        if (zeroForOne) {
            if (exactInput) {
                amount0 = amountSpecified;
                amount1 = -amountSpecified;
            } else {
                amount1 = amountSpecified;
                amount0 = -amountSpecified;
            }
        } else {
            if (exactInput) {
                amount1 = amountSpecified;
                amount0 = -amountSpecified;
            } else {
                amount0 = amountSpecified;
                amount1 = -amountSpecified;
            }
        }

        // Optimistically pay out the negative leg before invoking the callback,
        // exactly like real v3 pools do.
        if (amount0 < 0) IERC20(token0).transfer(recipient, uint256(-amount0));
        if (amount1 < 0) IERC20(token1).transfer(recipient, uint256(-amount1));

        uint256 balance0Before = IERC20(token0).balanceOf(address(this));
        uint256 balance1Before = IERC20(token1).balanceOf(address(this));

        IUniswapV3SwapCallback(msg.sender).uniswapV3SwapCallback(amount0, amount1, data);

        if (amount0 > 0) {
            require(IERC20(token0).balanceOf(address(this)) >= balance0Before + uint256(amount0), "IIA0");
        }
        if (amount1 > 0) {
            require(IERC20(token1).balanceOf(address(this)) >= balance1Before + uint256(amount1), "IIA1");
        }
    }
}
