// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MatchController} from "../src/MatchController.sol";
import {PitRouter} from "../src/PitRouter.sol";
import {IUniswapV3Factory} from "../src/interfaces/IUniswapV3Factory.sol";
import {IUniswapV3Pool} from "../src/interfaces/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "../src/interfaces/INonfungiblePositionManager.sol";

/// @title Deploy
/// @notice Full Base Sepolia deploy: get-or-create the USDC/WETH v3 pool, deploy
///         MatchController + PitRouter, mint the house liquidity position, wire
///         everything together. One transaction sequence, idempotent where
///         Uniswap already is (getPool short-circuits createPool).
///
/// Required env (see .env.example):
///   RUNNER_PRIVATE_KEY          deployer + MatchController operator, same key
///                                packages/runner uses to drive the match lifecycle
///   UNISWAP_V3_FACTORY_ADDRESS  0x4752bA5DBc23f44D87826276BF6Fd6b1C372aD24 (Base Sepolia)
///   POSITION_MANAGER_ADDRESS    0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2 (Base Sepolia)
///   USDC_ADDRESS                0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia)
///   WETH_ADDRESS                optional, defaults to 0x4200...0006 (OP-stack predeploy)
///
/// Required env for house liquidity (the deployer wallet must hold this much of
/// both tokens — get testnet USDC from faucet.circle.com and WETH by wrapping
/// Base Sepolia ETH):
///   USDC_SEED_AMOUNT             e.g. 500000000 (500 USDC, 6 decimals) — must clear
///                                 3x the $50 stake per docs/README.md
///   WETH_SEED_AMOUNT              e.g. 200000000000000000 (0.2 WETH, 18 decimals)
///   INITIAL_SQRT_PRICE_X96        the pool's starting price, Q64.96 — compute off
///                                 -chain for your chosen USDC/WETH ratio (e.g. with
///                                 Uniswap's own sqrtPriceX96 calculators); this
///                                 script does NOT guess a default, a wrong price
///                                 here just means an unfavorable first LP mint,
///                                 not a broken deploy
///
/// Optional (sane defaults below): MIN_POOL_LIQUIDITY, MIN_AGENTS, MAX_AGENTS,
/// TRADE_CAP_PER_ROUND, POOL_FEE_TIER
contract Deploy is Script {
    // Full-range ticks for the 0.3% fee tier (tickSpacing 60): nearest
    // multiples of 60 to the protocol's [MIN_TICK, MAX_TICK] = [-887272, 887272].
    int24 constant FULL_RANGE_TICK_LOWER = -887220;
    int24 constant FULL_RANGE_TICK_UPPER = 887220;

    function run() external {
        uint256 deployerPk = vm.envUint("RUNNER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        address factoryAddr = vm.envAddress("UNISWAP_V3_FACTORY_ADDRESS");
        address positionManagerAddr = vm.envAddress("POSITION_MANAGER_ADDRESS");
        address usdcAddr = vm.envAddress("USDC_ADDRESS");
        address wethAddr = vm.envOr("WETH_ADDRESS", address(0x4200000000000000000000000000000000000006));
        uint24 fee = uint24(vm.envOr("POOL_FEE_TIER", uint256(3000)));

        uint256 usdcSeed = vm.envUint("USDC_SEED_AMOUNT");
        uint256 wethSeed = vm.envUint("WETH_SEED_AMOUNT");
        uint160 initialSqrtPriceX96 = uint160(vm.envUint("INITIAL_SQRT_PRICE_X96"));

        uint128 minPoolLiquidity = uint128(vm.envOr("MIN_POOL_LIQUIDITY", uint256(1_000)));
        uint256 minAgents = vm.envOr("MIN_AGENTS", uint256(2));
        uint256 maxAgents = vm.envOr("MAX_AGENTS", uint256(3));
        uint256 tradeCapPerRound = vm.envOr("TRADE_CAP_PER_ROUND", uint256(5));

        console.log("deployer:", deployer);

        vm.startBroadcast(deployerPk);

        IUniswapV3Factory factory = IUniswapV3Factory(factoryAddr);
        address poolAddr = factory.getPool(usdcAddr, wethAddr, fee);
        if (poolAddr == address(0)) {
            poolAddr = factory.createPool(usdcAddr, wethAddr, fee);
            IUniswapV3Pool(poolAddr).initialize(initialSqrtPriceX96);
            console.log("created + initialized pool:", poolAddr);
        } else {
            console.log("reusing existing pool:", poolAddr);
        }

        MatchController controller =
            new MatchController(usdcAddr, poolAddr, positionManagerAddr, minPoolLiquidity, minAgents, maxAgents, deployer);
        console.log("MatchController:", address(controller));
        console.log("CommitReveal:", address(controller.commitReveal()));

        PitRouter router = new PitRouter(poolAddr, address(controller), tradeCapPerRound);
        console.log("PitRouter:", address(router));

        controller.setPitRouter(address(router));

        // Seed house liquidity, full-range, recipient = MatchController so the
        // contract itself owns the position and can collect() fees at settle().
        IUniswapV3Pool pool = IUniswapV3Pool(poolAddr);
        address token0 = pool.token0();
        address token1 = pool.token1();
        (uint256 amount0Desired, uint256 amount1Desired) =
            token0 == usdcAddr ? (usdcSeed, wethSeed) : (wethSeed, usdcSeed);

        IERC20(token0).approve(positionManagerAddr, amount0Desired);
        IERC20(token1).approve(positionManagerAddr, amount1Desired);

        INonfungiblePositionManager pm = INonfungiblePositionManager(positionManagerAddr);
        (uint256 tokenId,, uint256 amount0, uint256 amount1) = pm.mint(
            INonfungiblePositionManager.MintParams({
                token0: token0,
                token1: token1,
                fee: fee,
                tickLower: FULL_RANGE_TICK_LOWER,
                tickUpper: FULL_RANGE_TICK_UPPER,
                amount0Desired: amount0Desired,
                amount1Desired: amount1Desired,
                amount0Min: 0,
                amount1Min: 0,
                recipient: address(controller),
                // +15min buffer, not the exact current timestamp — a zero-tolerance
                // deadline reverts "Transaction too old" the moment inclusion lags
                // simulation/broadcast by even one block, which real deploys do.
                deadline: block.timestamp + 900
            })
        );
        console.log("house position tokenId:", tokenId);
        console.log("house liquidity amount0/amount1:", amount0, amount1);

        controller.setHousePosition(tokenId);

        vm.stopBroadcast();

        console.log("");
        console.log("=== fill these into .env ===");
        console.log("MATCH_CONTROLLER_ADDRESS=", address(controller));
        console.log("PIT_ROUTER_ADDRESS=", address(router));
        console.log("POOL_ADDRESS=", poolAddr);
    }
}
