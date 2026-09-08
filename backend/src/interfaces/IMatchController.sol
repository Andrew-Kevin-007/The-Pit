// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @notice The slice of MatchController that PitRouter needs to gate a swap.
interface IMatchController {
    /// @return round the current round index (0..5); meaningless if `live` is false
    /// @return live true iff `matchId` is LIVE and `block.timestamp` falls inside a round window
    function currentRoundOf(uint256 matchId) external view returns (uint8 round, bool live);

    /// @return true iff `agent` is a registered participant of `matchId`
    function isParticipant(uint256 matchId, address agent) external view returns (bool);
}
