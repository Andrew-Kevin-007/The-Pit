// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal Uniswap v3 Pool interface — swap + the read paths PitRouter/MatchController need.
/// @dev Mirrors Uniswap/v3-core's IUniswapV3PoolActions + IUniswapV3PoolState, trimmed to what's used.
interface IUniswapV3Pool {
    /// @notice Sets the pool's initial price. Must be called once, right after
    ///         IUniswapV3Factory.createPool(), before any liquidity can be minted.
    function initialize(uint160 sqrtPriceX96) external;

    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);

    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    function liquidity() external view returns (uint128);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

/// @notice Callback the pool invokes mid-`swap()`; PitRouter implements this to pay in.
interface IUniswapV3SwapCallback {
    function uniswapV3SwapCallback(int256 amount0Delta, int256 amount1Delta, bytes calldata data) external;
}
