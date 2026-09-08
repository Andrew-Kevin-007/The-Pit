// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice Minimal Uniswap v3 Factory interface — only what PitRouter/deploy scripts need.
/// @dev Mirrors Uniswap/v3-core's IUniswapV3Factory; reproduced locally to avoid
///      pulling the full v3-core repo (pinned to solc 0.7.6) into a 0.8.x project.
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
    function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool);
}
