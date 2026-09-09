// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {INonfungiblePositionManager} from "../../src/interfaces/INonfungiblePositionManager.sol";
import {MockERC20} from "./MockERC20.sol";

/// @notice Just enough of INonfungiblePositionManager for MatchController.settle()'s
///         fee-collection path. `collect()` mints and transfers a controllable
///         (amount0, amount1) to the recipient so settle()'s rebate math is checkable
///         end-to-end rather than mocked-return-value theater. `mint()`/`positions()`
///         are not on that path and are stubbed out.
contract MockPositionManager is INonfungiblePositionManager {
    MockERC20 public immutable token0;
    MockERC20 public immutable token1;

    uint256 public nextCollectAmount0;
    uint256 public nextCollectAmount1;

    constructor(address token0_, address token1_) {
        token0 = MockERC20(token0_);
        token1 = MockERC20(token1_);
    }

    /// @notice Test-only setter for what the next `collect()` call pays out.
    function setNextCollectAmounts(uint256 amount0, uint256 amount1) external {
        nextCollectAmount0 = amount0;
        nextCollectAmount1 = amount1;
    }

    function collect(CollectParams calldata params) external payable returns (uint256 amount0, uint256 amount1) {
        amount0 = nextCollectAmount0;
        amount1 = nextCollectAmount1;
        // Real `collect()` consumes the owed fees; reset so a second call without a
        // fresh setter returns nothing, matching that "fees are gone once collected".
        nextCollectAmount0 = 0;
        nextCollectAmount1 = 0;

        if (amount0 > 0) token0.mint(params.recipient, amount0);
        if (amount1 > 0) token1.mint(params.recipient, amount1);
    }

    function mint(MintParams calldata)
        external
        payable
        returns (uint256, uint128, uint256, uint256)
    {
        revert("MockPositionManager: mint not implemented");
    }

    function positions(uint256)
        external
        pure
        returns (
            uint96 nonce,
            address operator,
            address token0_,
            address token1_,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint256 feeGrowthInside0LastX128,
            uint256 feeGrowthInside1LastX128,
            uint128 tokensOwed0,
            uint128 tokensOwed1
        )
    {
        return (0, address(0), address(0), address(0), 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
