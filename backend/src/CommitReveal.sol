// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title CommitReveal
/// @notice Stores each agent's hashed strategy config before a match and verifies
///         the plaintext against it after. Called exclusively by MatchController —
///         this contract holds no funds and has no other privileged surface.
/// @dev Preimage format is frozen by the runner's `commitHash()`
///      (packages/runner/src/lifecycle.ts) and MUST match exactly:
///
///        keccak256(utf8Bytes(canonicalConfigString(cfg)) || utf8Bytes("\n") || rawBytes(salt))
///
///      i.e. `keccak256(abi.encodePacked(config, "\n", salt))` in Solidity, where
///      `config` is the exact canonical JSON string the runner hands to `reveal()`.
///      docs/INTERFACE-FREEZE.md §2 describes the same scheme without the "\n"
///      separator — the runner's TS is authoritative since it's what actually
///      signs the transaction; this contract matches the runner, not the prose.
contract CommitReveal {
    error NotController();
    error AlreadyCommitted();
    error NoCommitment();
    error AlreadyRevealed();
    error HashMismatch();

    address public immutable controller;

    /// matchId => agent => commitHash (bytes32(0) == no commitment yet)
    mapping(uint256 => mapping(address => bytes32)) public commitments;
    /// matchId => agent => revealed plaintext config (empty until revealed)
    mapping(uint256 => mapping(address => string)) public revealedConfigs;

    event Committed(uint256 indexed matchId, address indexed agent, bytes32 commitHash);
    event Revealed(uint256 indexed matchId, address indexed agent, string config);

    modifier onlyController() {
        if (msg.sender != controller) revert NotController();
        _;
    }

    constructor(address controller_) {
        controller = controller_;
    }

    /// @notice Record `agent`'s hashed strategy config for `matchId`. One-shot per agent per match.
    function commit(uint256 matchId, address agent, bytes32 commitHash) external onlyController {
        if (commitments[matchId][agent] != bytes32(0)) revert AlreadyCommitted();
        commitments[matchId][agent] = commitHash;
        emit Committed(matchId, agent, commitHash);
    }

    /// @notice Verify `config`+`salt` hash to the stored commitment and record the plaintext.
    /// @dev Reverts on mismatch — MatchController decides whether that's fatal to settlement.
    function reveal(uint256 matchId, address agent, string calldata config, bytes32 salt)
        external
        onlyController
    {
        bytes32 stored = commitments[matchId][agent];
        if (stored == bytes32(0)) revert NoCommitment();
        if (bytes(revealedConfigs[matchId][agent]).length != 0) revert AlreadyRevealed();

        bytes32 computed = keccak256(abi.encodePacked(config, "\n", salt));
        if (computed != stored) revert HashMismatch();

        revealedConfigs[matchId][agent] = config;
        emit Revealed(matchId, agent, config);
    }

    function isRevealed(uint256 matchId, address agent) external view returns (bool) {
        return bytes(revealedConfigs[matchId][agent]).length != 0;
    }

    function hasCommitted(uint256 matchId, address agent) external view returns (bool) {
        return commitments[matchId][agent] != bytes32(0);
    }
}
