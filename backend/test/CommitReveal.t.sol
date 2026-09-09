// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {CommitReveal} from "../src/CommitReveal.sol";

contract CommitRevealTest is Test {
    CommitReveal internal commitReveal;

    address internal controller = makeAddr("controller");
    address internal stranger = makeAddr("stranger");
    address internal agent = makeAddr("agent");

    uint256 internal constant MATCH_ID = 1;
    string internal constant CONFIG = '{"strategy":"momentum","maxTradesPerRound":3}';
    bytes32 internal constant SALT = keccak256("salt-1");

    function setUp() public {
        commitReveal = new CommitReveal(controller);
    }

    function _hash(string memory config, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(config, "\n", salt));
    }

    // ---------------------------------------------------------------- commit

    function test_Commit_OnlyController() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.prank(stranger);
        vm.expectRevert(CommitReveal.NotController.selector);
        commitReveal.commit(MATCH_ID, agent, commitHash);
    }

    function test_Commit_ByController_Succeeds() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.prank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);

        assertTrue(commitReveal.hasCommitted(MATCH_ID, agent));
        assertEq(commitReveal.commitments(MATCH_ID, agent), commitHash);
    }

    function test_Commit_DoubleCommit_Reverts() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.startPrank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);
        vm.expectRevert(CommitReveal.AlreadyCommitted.selector);
        commitReveal.commit(MATCH_ID, agent, commitHash);
        vm.stopPrank();
    }

    // ---------------------------------------------------------------- reveal

    function test_Reveal_ExactPreimage_Succeeds() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.prank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);

        vm.prank(controller);
        commitReveal.reveal(MATCH_ID, agent, CONFIG, SALT);

        assertTrue(commitReveal.isRevealed(MATCH_ID, agent));
        assertEq(commitReveal.revealedConfigs(MATCH_ID, agent), CONFIG);
    }

    function test_Reveal_OnlyController() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.prank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);

        vm.prank(stranger);
        vm.expectRevert(CommitReveal.NotController.selector);
        commitReveal.reveal(MATCH_ID, agent, CONFIG, SALT);
    }

    function test_Reveal_DifferentConfig_Reverts() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.prank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);

        vm.prank(controller);
        vm.expectRevert(CommitReveal.HashMismatch.selector);
        commitReveal.reveal(MATCH_ID, agent, '{"strategy":"different"}', SALT);
    }

    function test_Reveal_DifferentSalt_Reverts() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.prank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);

        vm.prank(controller);
        vm.expectRevert(CommitReveal.HashMismatch.selector);
        commitReveal.reveal(MATCH_ID, agent, CONFIG, keccak256("salt-2"));
    }

    function test_Reveal_WithoutCommit_Reverts() public {
        vm.prank(controller);
        vm.expectRevert(CommitReveal.NoCommitment.selector);
        commitReveal.reveal(MATCH_ID, agent, CONFIG, SALT);
    }

    function test_Reveal_DoubleReveal_Reverts() public {
        bytes32 commitHash = _hash(CONFIG, SALT);
        vm.startPrank(controller);
        commitReveal.commit(MATCH_ID, agent, commitHash);
        commitReveal.reveal(MATCH_ID, agent, CONFIG, SALT);

        vm.expectRevert(CommitReveal.AlreadyRevealed.selector);
        commitReveal.reveal(MATCH_ID, agent, CONFIG, SALT);
        vm.stopPrank();
    }

    function test_Constructor_SetsController() public view {
        assertEq(commitReveal.controller(), controller);
    }
}
