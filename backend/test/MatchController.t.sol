// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PitTestBase} from "./helpers/PitTestBase.sol";
import {MatchController} from "../src/MatchController.sol";
import {CommitReveal} from "../src/CommitReveal.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockUniswapV3Pool} from "./mocks/MockUniswapV3Pool.sol";
import {MockPositionManager} from "./mocks/MockPositionManager.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MatchControllerTest is PitTestBase {
    uint256 internal constant MATCH_ID = 1;

    address internal agentA = makeAddr("agentA");
    address internal agentB = makeAddr("agentB");
    address internal agentC = makeAddr("agentC");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        _deployCore();
        _fundAgent(agentA);
        _fundAgent(agentB);
        _fundAgent(agentC);
    }

    // ---------------------------------------------------------------- register()

    /// @dev register() does NOT custody the stake (see MatchController's contract
    ///      docstring: the agent keeps trading it directly out of its own wallet
    ///      through PitRouter) — it only verifies the wallet already holds enough,
    ///      and leaves every wei of it right where it was.
    function test_Register_DoesNotMoveFunds_OnlyVerifiesBalance() public {
        uint256 agentBalBefore = usdc.balanceOf(agentA);
        uint256 controllerBalBefore = usdc.balanceOf(address(controller));

        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));

        assertEq(usdc.balanceOf(agentA), agentBalBefore, "register must not move the agent's USDC");
        assertEq(usdc.balanceOf(address(controller)), controllerBalBefore, "controller must not custody any USDC");
        assertTrue(controller.isParticipant(MATCH_ID, agentA));
    }

    function test_Register_RevertsInsufficientBalance() public {
        address broke = makeAddr("broke");
        vm.prank(operator);
        vm.expectRevert(MatchController.InsufficientBalance.selector);
        controller.register(MATCH_ID, broke, keccak256("h"), STAKE);
    }

    function test_Register_RevertsWrongStake() public {
        vm.prank(operator);
        vm.expectRevert(MatchController.WrongStake.selector);
        controller.register(MATCH_ID, agentA, keccak256("h"), STAKE - 1);
    }

    function test_Register_RevertsAlreadyRegistered() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));

        vm.prank(operator);
        vm.expectRevert(MatchController.AlreadyRegistered.selector);
        controller.register(MATCH_ID, agentA, keccak256("h2"), STAKE);
    }

    function test_Register_RevertsRosterFull() public {
        address agentD = makeAddr("agentD");
        _fundAgent(agentD);

        // MAX_AGENTS == 4
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _register(MATCH_ID, agentC, "cfgC", keccak256("saltC"));
        _register(MATCH_ID, agentD, "cfgD", keccak256("saltD"));

        address agentE = makeAddr("agentE");
        _fundAgent(agentE);
        vm.prank(operator);
        vm.expectRevert(MatchController.RosterFull.selector);
        controller.register(MATCH_ID, agentE, keccak256("h"), STAKE);
    }

    function test_Register_RevertsWrongStatus_AfterMatchStarted() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        vm.prank(operator);
        vm.expectRevert(MatchController.WrongStatus.selector);
        controller.register(MATCH_ID, agentC, keccak256("h"), STAKE);
    }

    // ---------------------------------------------------------------- startMatch()

    function test_StartMatch_RevertsPoolTooShallow() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));

        pool.setLiquidity(MIN_POOL_LIQUIDITY - 1);

        vm.prank(operator);
        vm.expectRevert(MatchController.PoolTooShallow.selector);
        controller.startMatch(MATCH_ID);
    }

    function test_StartMatch_SucceedsAboveThreshold() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));

        pool.setLiquidity(MIN_POOL_LIQUIDITY); // exactly at the gate — `>=` should pass

        _startMatch(MATCH_ID);

        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.LIVE));
    }

    function test_StartMatch_RevertsNotEnoughAgents() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA")); // MIN_AGENTS == 2, only 1 registered

        vm.prank(operator);
        vm.expectRevert(MatchController.NotEnoughAgents.selector);
        controller.startMatch(MATCH_ID);
    }

    // ---------------------------------------------------------------- lockRound()

    function test_LockRound_RevertsOutOfOrder() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        vm.prank(operator);
        vm.expectRevert(MatchController.OutOfOrderRound.selector);
        controller.lockRound(MATCH_ID, 1); // must start at round 0
    }

    function test_LockRound_RevertsOnRepeatOfSameRound() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        vm.warp(block.timestamp + controller.ROUND_SECONDS());
        vm.prank(operator);
        controller.lockRound(MATCH_ID, 0);

        vm.prank(operator);
        vm.expectRevert(MatchController.OutOfOrderRound.selector);
        controller.lockRound(MATCH_ID, 0); // repeat of an already-locked round
    }

    function test_LockRound_RevertsBeforeRoundElapsed() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        vm.prank(operator);
        vm.expectRevert(MatchController.RoundNotElapsed.selector);
        controller.lockRound(MATCH_ID, 0); // called at startTime + 0s, needs startTime + 90s

        vm.warp(block.timestamp + controller.ROUND_SECONDS() - 1);
        vm.prank(operator);
        vm.expectRevert(MatchController.RoundNotElapsed.selector);
        controller.lockRound(MATCH_ID, 0); // 1 second short
    }

    function test_LockRound_EmitsBalancePerParticipant() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        uint256 balA = usdc.balanceOf(agentA);
        uint256 balB = usdc.balanceOf(agentB);

        vm.warp(block.timestamp + controller.ROUND_SECONDS());

        vm.expectEmit(true, true, false, true, address(controller));
        emit MatchController.RoundLocked(MATCH_ID, 0, agentA, balA, block.timestamp);
        vm.expectEmit(true, true, false, true, address(controller));
        emit MatchController.RoundLocked(MATCH_ID, 0, agentB, balB, block.timestamp);

        vm.prank(operator);
        controller.lockRound(MATCH_ID, 0);
    }

    function test_LockRound_SixthLockFlipsToLocked() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        for (uint8 r = 0; r < 5; r++) {
            vm.warp(block.timestamp + controller.ROUND_SECONDS());
            vm.prank(operator);
            controller.lockRound(MATCH_ID, r);
            assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.LIVE), "still LIVE before the 6th lock");
        }

        vm.warp(block.timestamp + controller.ROUND_SECONDS());
        vm.prank(operator);
        controller.lockRound(MATCH_ID, 5);
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.LOCKED), "LOCKED after the 6th lock");
    }

    // ---------------------------------------------------------------- reveal()

    function test_Reveal_RevertsHashMismatch_BubbledFromCommitReveal() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);
        _lockAllRounds(MATCH_ID);

        vm.prank(operator);
        vm.expectRevert(CommitReveal.HashMismatch.selector);
        controller.reveal(MATCH_ID, agentA, "wrong-config", keccak256("saltA"));
    }

    function test_Reveal_AllParticipantsFlipsToRevealed() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);
        _lockAllRounds(MATCH_ID);

        vm.prank(operator);
        controller.reveal(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.LOCKED), "not yet REVEALED after only 1 of 2");

        vm.prank(operator);
        controller.reveal(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.REVEALED));
    }

    // ---------------------------------------------------------------- settle()

    function test_Settle_RevertsWrongStatus() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID); // status LIVE, not REVEALED

        vm.prank(operator);
        vm.expectRevert(MatchController.WrongStatus.selector);
        controller.settle(MATCH_ID);
    }

    // @dev NotAllRevealed is NOT exercised here: reveal() only ever flips status to
    // REVEALED in the same statement that observes revealedCount == participants.length,
    // and revealedCount never decreases. So by the time settle() can even reach its own
    // `status == REVEALED` gate, revealedCount == participants.length is already a hard
    // invariant — there is no reachable call sequence through the public API that leaves
    // status == REVEALED with revealedCount < participants.length. The check in settle()
    // looks like intentional defense-in-depth, but as written it is dead code / untestable
    // from outside. Flagged in the final report instead of faked with a storage-cheat test.

    function test_Settle_PicksHighestBalanceWinner() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _register(MATCH_ID, agentC, "cfgC", keccak256("saltC"));
        _startMatch(MATCH_ID);
        _lockAllRounds(MATCH_ID);

        vm.prank(operator);
        controller.reveal(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        vm.prank(operator);
        controller.reveal(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        vm.prank(operator);
        controller.reveal(MATCH_ID, agentC, "cfgC", keccak256("saltC"));

        // Give B the strictly highest final balance.
        usdc.mint(agentB, 5_000_000);
        usdc.mint(agentC, 2_000_000);

        uint256[] memory zeroRebates = new uint256[](3); // no house position/router wired for this match

        vm.expectEmit(true, true, false, true, address(controller));
        emit MatchController.MatchSettled(MATCH_ID, agentB, zeroRebates);

        vm.prank(operator);
        controller.settle(MATCH_ID);

        assertEq(uint8(controller.statusOf(MATCH_ID)), uint8(MatchController.Status.SETTLED));
    }

    function test_Settle_TieBreak_EarliestRegisteredWins() public {
        // agentA registered before agentB; with no extra minting their final balances
        // are identical (equal stake pulled, equal trade-funding minted, no swaps).
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);
        _lockAllRounds(MATCH_ID);

        vm.prank(operator);
        controller.reveal(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        vm.prank(operator);
        controller.reveal(MATCH_ID, agentB, "cfgB", keccak256("saltB"));

        assertEq(usdc.balanceOf(agentA), usdc.balanceOf(agentB), "precondition: exact tie");

        uint256[] memory zeroRebates = new uint256[](2);
        vm.expectEmit(true, true, false, true, address(controller));
        emit MatchController.MatchSettled(MATCH_ID, agentA, zeroRebates); // earliest-registered wins the tie

        vm.prank(operator);
        controller.settle(MATCH_ID);
    }

    function test_Settle_NoHousePositionOrRouter_AllZeroRebates_StillSucceeds() public {
        // A totally fresh controller where neither setPitRouter nor setHousePosition
        // was ever called — settlement must still work standalone.
        MockERC20 freshUsdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 freshTokB = new MockERC20("Token B", "TOKB", 18);
        MockUniswapV3Pool freshPool = new MockUniswapV3Pool(address(freshUsdc), address(freshTokB), POOL_FEE, MIN_POOL_LIQUIDITY);
        MockPositionManager freshPosManager = new MockPositionManager(address(freshUsdc), address(freshTokB));
        MatchController freshController = new MatchController(
            address(freshUsdc), address(freshPool), address(freshPosManager), MIN_POOL_LIQUIDITY, MIN_AGENTS, MAX_AGENTS, operator
        );
        // Deliberately never call freshController.setPitRouter / setHousePosition.

        address a = makeAddr("freshA");
        address b = makeAddr("freshB");
        freshUsdc.mint(a, STAKE);
        freshUsdc.mint(b, STAKE);
        vm.prank(a);
        freshUsdc.approve(address(freshController), type(uint256).max);
        vm.prank(b);
        freshUsdc.approve(address(freshController), type(uint256).max);

        vm.prank(operator);
        freshController.register(MATCH_ID, a, keccak256(abi.encodePacked("cfgA", "\n", keccak256("sA"))), STAKE);
        vm.prank(operator);
        freshController.register(MATCH_ID, b, keccak256(abi.encodePacked("cfgB", "\n", keccak256("sB"))), STAKE);
        vm.prank(operator);
        freshController.startMatch(MATCH_ID);
        for (uint8 r = 0; r < 6; r++) {
            vm.warp(block.timestamp + freshController.ROUND_SECONDS());
            vm.prank(operator);
            freshController.lockRound(MATCH_ID, r);
        }
        vm.prank(operator);
        freshController.reveal(MATCH_ID, a, "cfgA", keccak256("sA"));
        vm.prank(operator);
        freshController.reveal(MATCH_ID, b, "cfgB", keccak256("sB"));

        uint256[] memory zeroRebates = new uint256[](2);
        vm.expectEmit(true, true, false, true, address(freshController));
        emit MatchController.MatchSettled(MATCH_ID, a, zeroRebates); // tie -> earliest registered

        vm.prank(operator);
        freshController.settle(MATCH_ID);

        assertEq(uint8(freshController.statusOf(MATCH_ID)), uint8(MatchController.Status.SETTLED));
    }

    function test_Settle_RebateAmounts_SumIndexAlignedAndCredited() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));
        _startMatch(MATCH_ID);

        // Round 0: agents trade through PitRouter to accrue fees in a clean 1:3 ratio.
        vm.prank(agentA);
        router.swap(MATCH_ID, true, int256(1_000_000), 0); // fee = 1,000,000 * 3000 / 1e6 = 3,000
        vm.prank(agentB);
        router.swap(MATCH_ID, true, int256(3_000_000), 0); // fee = 3,000,000 * 3000 / 1e6 = 9,000

        assertEq(router.totalFeeAccrued(MATCH_ID), 12_000);

        vm.prank(operator);
        controller.setHousePosition(1);
        posManager.setNextCollectAmounts(1_200_000, 0); // 1.2 USDC of collected house fees

        _lockAllRounds(MATCH_ID);
        vm.prank(operator);
        controller.reveal(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        vm.prank(operator);
        controller.reveal(MATCH_ID, agentB, "cfgB", keccak256("saltB"));

        uint256 aBalBefore = usdc.balanceOf(agentA);
        uint256 bBalBefore = usdc.balanceOf(agentB);

        // participantsOf() order is registration order: [agentA, agentB].
        uint256[] memory expectedRebates = new uint256[](2);
        expectedRebates[0] = 300_000; // 1,200,000 * 3,000 / 12,000
        expectedRebates[1] = 900_000; // 1,200,000 * 9,000 / 12,000
        assertEq(expectedRebates[0] + expectedRebates[1], 1_200_000, "rebates sum to the collected amount");

        address[] memory participants = controller.participantsOf(MATCH_ID);
        assertEq(participants[0], agentA);
        assertEq(participants[1], agentB);

        // Winner is decided purely on usdc.balanceOf: A spent less USDC on its smaller
        // swap than B did, so A holds the higher USDC balance (the TOKB each received
        // doesn't count — settle() only looks at the USDC leg).
        vm.expectEmit(true, true, false, true, address(controller));
        emit MatchController.MatchSettled(MATCH_ID, agentA, expectedRebates);

        vm.prank(operator);
        controller.settle(MATCH_ID);

        assertEq(usdc.balanceOf(agentA), aBalBefore + expectedRebates[0], "agentA credited exactly its rebate");
        assertEq(usdc.balanceOf(agentB), bBalBefore + expectedRebates[1], "agentB credited exactly its rebate");
    }

    // ---------------------------------------------------------------- submitPick()

    function test_SubmitPick_RevertsUnknownAgent() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));

        vm.prank(stranger);
        vm.expectRevert(MatchController.UnknownAgent.selector);
        controller.submitPick(MATCH_ID, stranger);
    }

    function test_SubmitPick_SucceedsForParticipant_CallableByAnyone() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));

        // `stranger` is neither the owner/operator nor a participant — anyone can pick.
        vm.expectEmit(true, true, false, true, address(controller));
        emit MatchController.PickSubmitted(MATCH_ID, stranger, agentA);

        vm.prank(stranger);
        controller.submitPick(MATCH_ID, agentA);
    }

    // ---------------------------------------------------------------- setPitRouter / setHousePosition

    function test_SetPitRouter_OnceOnly() public {
        // _deployCore() already called setPitRouter(router) once during setUp.
        assertEq(controller.pitRouter(), address(router));

        vm.prank(operator);
        vm.expectRevert(MatchController.PitRouterAlreadySet.selector);
        controller.setPitRouter(makeAddr("anotherRouter"));
    }

    function test_SetHousePosition_OnceOnly() public {
        vm.prank(operator);
        controller.setHousePosition(42);
        assertEq(controller.housePositionTokenId(), 42);
        assertTrue(controller.housePositionSet());

        vm.prank(operator);
        vm.expectRevert(MatchController.PitRouterAlreadySet.selector); // yes — reuses the same error
        controller.setHousePosition(43);
    }

    // ---------------------------------------------------------------- access control (bonus)

    function test_Register_RevertsForNonOwner() public {
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        controller.register(MATCH_ID, agentA, keccak256("h"), STAKE);
    }

    function test_Settle_RevertsForNonOwner() public {
        _register(MATCH_ID, agentA, "cfgA", keccak256("saltA"));
        _register(MATCH_ID, agentB, "cfgB", keccak256("saltB"));

        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        controller.settle(MATCH_ID);
    }
}
