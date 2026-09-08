// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {CommitReveal} from "./CommitReveal.sol";
import {IUniswapV3Pool} from "./interfaces/IUniswapV3Pool.sol";
import {INonfungiblePositionManager} from "./interfaces/INonfungiblePositionManager.sol";

interface IPitRouterFees {
    function feeAccruedByAgent(uint256 matchId, address agent) external view returns (uint256);
    function totalFeeAccrued(uint256 matchId) external view returns (uint256);
}

/// @title MatchController
/// @notice Generic commit-and-fund registration, round advancement/timing, and
///         settlement for The Pit. Any wallet that completes the same flow gets
///         the same enforcement — no per-agent hardcoding anywhere in this contract.
/// @dev Lifecycle calls (register/startMatch/lockRound/reveal/settle) are
///      operator-gated (`onlyOwner`) because packages/runner drives all of them
///      from a single backend-managed wallet (see chainWrite/chainRegister in
///      packages/runner/src/lifecycle.ts). `swap()` itself (PitRouter) is gated
///      per-agent instead, since each agent's own wallet signs that call.
///      This contract never custodies agent funds: `register()` only verifies
///      the agent's wallet already holds >= STAKE_USDC, it never pulls it in.
///      Agents trade directly out of their own wallet through PitRouter for the
///      exact reason docs/STATE-MODEL.md gives — "on-chain USDC balances = score,
///      no oracle" only holds if the balance being read is the agent's own,
///      unencumbered wallet, the same one `lockRound`/`settle` read via
///      `balanceOf`. (Ownable2Step so a mistyped `transferOwnership` can't
///      silently brick every lifecycle call for every open match.)
contract MatchController is Ownable2Step {
    using SafeERC20 for IERC20;

    enum Status {
        REGISTERING,
        LIVE,
        LOCKED,
        REVEALED,
        SETTLED
    }

    error WrongStatus();
    error AlreadyRegistered();
    error WrongStake();
    error InsufficientBalance();
    error RosterFull();
    error NotEnoughAgents();
    error PoolTooShallow();
    error UnknownAgent();
    error OutOfOrderRound();
    error RoundNotElapsed();
    error NotAllRevealed();
    error PitRouterAlreadySet();
    error ZeroAddress();

    uint8 public constant ROUND_COUNT = 6;
    uint256 public constant ROUND_SECONDS = 50; // 6 x 50s = 300s (5 min) match
    uint256 public constant STAKE_USDC = 1_000_000; // 1 * 1e6, USDC has 6 decimals

    IERC20 public immutable usdc;
    IUniswapV3Pool public immutable pool;
    INonfungiblePositionManager public immutable positionManager;
    CommitReveal public immutable commitReveal;
    uint128 public immutable minPoolLiquidity;
    uint256 public immutable minAgents;
    uint256 public immutable maxAgents;

    /// @dev Set once post-deploy (PitRouter's constructor needs this contract's
    ///      address, so it can only exist — and only then be wired back in — after
    ///      MatchController itself is already on-chain).
    address public pitRouter;
    /// @dev The house LP NFT id, set once after the deploy script mints the house
    ///      position with `recipient = address(this)`.
    uint256 public housePositionTokenId;
    bool public housePositionSet;

    struct MatchData {
        Status status;
        uint256 startTime;
        address[] participants;
        mapping(address => bool) isParticipant;
        uint8 roundsLocked;
        uint8 revealedCount;
        address winner;
        bool wonSet;
    }

    mapping(uint256 => MatchData) private matches_;

    event AgentRegistered(address indexed agent, bytes32 commitHash, uint256 stake, uint256 indexed matchId);
    event MatchStarted(uint256 indexed matchId, uint256 startTime, address[] agents);
    event RoundLocked(uint256 indexed matchId, uint8 round, address indexed agent, uint256 usdcBalance, uint256 timestamp);
    event StrategyRevealed(uint256 indexed matchId, address indexed agent, string config);
    event MatchSettled(uint256 indexed matchId, address indexed winner, uint256[] rebateAmounts);
    event PickSubmitted(uint256 indexed matchId, address indexed spectator, address side);

    constructor(
        address usdc_,
        address pool_,
        address positionManager_,
        uint128 minPoolLiquidity_,
        uint256 minAgents_,
        uint256 maxAgents_,
        address operator_
    ) Ownable(operator_) {
        if (usdc_ == address(0) || pool_ == address(0) || positionManager_ == address(0)) revert ZeroAddress();
        usdc = IERC20(usdc_);
        pool = IUniswapV3Pool(pool_);
        positionManager = INonfungiblePositionManager(positionManager_);
        minPoolLiquidity = minPoolLiquidity_;
        minAgents = minAgents_;
        maxAgents = maxAgents_;
        commitReveal = new CommitReveal(address(this));

        // The house pool must actually be a USDC pool — everything downstream
        // (stakes, round-lock balances, rebates) is denominated in it.
        require(pool.token0() == usdc_ || pool.token1() == usdc_, "pool must be a USDC pool");
    }

    /// @notice One-time wiring of the PitRouter deployed against this controller.
    function setPitRouter(address router) external onlyOwner {
        if (pitRouter != address(0)) revert PitRouterAlreadySet();
        if (router == address(0)) revert ZeroAddress();
        pitRouter = router;
    }

    /// @notice One-time registration of the house LP position this contract owns,
    ///         minted by the deploy script with `recipient = address(this)`.
    function setHousePosition(uint256 tokenId) external onlyOwner {
        if (housePositionSet) revert PitRouterAlreadySet();
        housePositionTokenId = tokenId;
        housePositionSet = true;
    }

    // ---------------------------------------------------------------- registration

    /// @notice Register `agent` for `matchId` and store its hashed strategy
    ///         config. Generic — works for any wallet that already holds
    ///         >= STAKE_USDC. Deliberately does NOT pull the stake into this
    ///         contract: the agent keeps trading it directly out of its own
    ///         wallet through PitRouter for the rest of the match (see the
    ///         contract-level docstring) — pulling it in here would strand it,
    ///         since nothing ever pays custodied funds back out.
    function register(uint256 matchId, address agent, bytes32 commitHash, uint256 stake) external onlyOwner {
        MatchData storage m = matches_[matchId];
        if (m.status != Status.REGISTERING) revert WrongStatus();
        if (m.isParticipant[agent]) revert AlreadyRegistered();
        if (stake != STAKE_USDC) revert WrongStake();
        if (m.participants.length >= maxAgents) revert RosterFull();
        if (usdc.balanceOf(agent) < stake) revert InsufficientBalance();

        commitReveal.commit(matchId, agent, commitHash);

        m.isParticipant[agent] = true;
        m.participants.push(agent);

        emit AgentRegistered(agent, commitHash, stake, matchId);
    }

    /// @notice Flip REGISTERING -> LIVE once the roster meets `minAgents` and the
    ///         house pool clears the minimum-depth gate.
    function startMatch(uint256 matchId) external onlyOwner {
        MatchData storage m = matches_[matchId];
        if (m.status != Status.REGISTERING) revert WrongStatus();
        if (m.participants.length < minAgents) revert NotEnoughAgents();
        if (pool.liquidity() < minPoolLiquidity) revert PoolTooShallow();

        m.status = Status.LIVE;
        m.startTime = block.timestamp;

        emit MatchStarted(matchId, m.startTime, m.participants);
    }

    // ---------------------------------------------------------------- rounds

    /// @return round the current round index (0..5); meaningless if `live` is false
    /// @return live true iff `matchId` is LIVE and `block.timestamp` is inside a round window
    function currentRoundOf(uint256 matchId) external view returns (uint8 round, bool live) {
        MatchData storage m = matches_[matchId];
        if (m.status != Status.LIVE) return (0, false);
        uint256 elapsed = block.timestamp - m.startTime;
        uint256 matchLen = uint256(ROUND_COUNT) * ROUND_SECONDS;
        if (elapsed >= matchLen) return (0, false);
        return (uint8(elapsed / ROUND_SECONDS), true);
    }

    function isParticipant(uint256 matchId, address agent) external view returns (bool) {
        return matches_[matchId].isParticipant[agent];
    }

    function participantsOf(uint256 matchId) external view returns (address[] memory) {
        return matches_[matchId].participants;
    }

    function statusOf(uint256 matchId) external view returns (Status) {
        return matches_[matchId].status;
    }

    /// @notice Read every participant's on-chain USDC balance and freeze it as the
    ///         record for `round`. Rounds must be locked in order (0..5); the 6th
    ///         lock flips the match to LOCKED. Balances read here are exactly what
    ///         `settle()` later uses for the winner + pnl — no separate read.
    function lockRound(uint256 matchId, uint8 round) external onlyOwner {
        MatchData storage m = matches_[matchId];
        if (m.status != Status.LIVE) revert WrongStatus();
        if (round != m.roundsLocked) revert OutOfOrderRound();
        // The 90s-per-round window is a contract invariant, not just a runner
        // promise: an operator (honest or compromised) cannot collapse the
        // trading window by locking rounds back-to-back before they've elapsed.
        if (block.timestamp < m.startTime + (uint256(round) + 1) * ROUND_SECONDS) revert RoundNotElapsed();

        uint256 n = m.participants.length;
        for (uint256 i = 0; i < n; i++) {
            address agent = m.participants[i];
            uint256 bal = usdc.balanceOf(agent);
            emit RoundLocked(matchId, round, agent, bal, block.timestamp);
        }

        m.roundsLocked = round + 1;
        if (m.roundsLocked == ROUND_COUNT) {
            m.status = Status.LOCKED;
        }
    }

    // ---------------------------------------------------------------- reveal

    function reveal(uint256 matchId, address agent, string calldata config, bytes32 salt) external onlyOwner {
        MatchData storage m = matches_[matchId];
        if (m.status != Status.LOCKED) revert WrongStatus();
        if (!m.isParticipant[agent]) revert UnknownAgent();

        commitReveal.reveal(matchId, agent, config, salt);
        m.revealedCount += 1;

        emit StrategyRevealed(matchId, agent, config);

        if (m.revealedCount == m.participants.length) {
            m.status = Status.REVEALED;
        }
    }

    // ---------------------------------------------------------------- settlement

    /// @notice Determine the winner from the frozen round-6 balances, harvest the
    ///         house position's accrued swap fees, and rebate them back into each
    ///         agent's own wallet proportional to the fee volume that agent
    ///         generated through PitRouter — so ordinary trading fees don't make
    ///         "do nothing" the winning strategy.
    function settle(uint256 matchId) external onlyOwner {
        MatchData storage m = matches_[matchId];
        if (m.status != Status.REVEALED) revert WrongStatus();
        if (m.revealedCount != m.participants.length) revert NotAllRevealed();

        uint256 n = m.participants.length;
        address winner = m.participants[0];
        uint256 winnerBal = usdc.balanceOf(winner);
        for (uint256 i = 1; i < n; i++) {
            uint256 bal = usdc.balanceOf(m.participants[i]);
            if (bal > winnerBal) {
                winner = m.participants[i];
                winnerBal = bal;
            }
        }
        m.winner = winner;
        m.wonSet = true;
        // Effects before interactions: status flips to terminal before any external
        // fee-collection/transfer call below, so a reentrant call sees a SETTLED
        // (fully-guarded) match, not a REVEALED one mid-settlement.
        m.status = Status.SETTLED;

        uint256[] memory rebateAmounts = new uint256[](n);
        if (housePositionSet && pitRouter != address(0)) {
            // Fee collection is wrapped in try/catch on purpose: a misconfigured
            // or later-invalidated house position (finding from review — settle()
            // used to revert unconditionally here, permanently bricking every
            // match on this deployment since matchId status is per-match but
            // pitRouter/housePositionTokenId are contract-global) must never stop
            // the winner from being recorded — worst case, rebates are just zero.
            uint256 collected;
            try this.collectHouseFeesInUsdc() returns (uint256 c) {
                collected = c;
            } catch {
                collected = 0;
            }
            uint256 total = IPitRouterFees(pitRouter).totalFeeAccrued(matchId);
            if (collected > 0 && total > 0) {
                for (uint256 i = 0; i < n; i++) {
                    address agent = m.participants[i];
                    uint256 agentFee = IPitRouterFees(pitRouter).feeAccruedByAgent(matchId, agent);
                    uint256 rebate = (collected * agentFee) / total;
                    if (rebate > 0) {
                        rebateAmounts[i] = rebate;
                        usdc.safeTransfer(agent, rebate);
                    }
                }
            }
        }

        emit MatchSettled(matchId, winner, rebateAmounts);
    }

    /// @dev Collects the house position's accrued fees and returns only the USDC
    ///      leg. Any non-USDC leg (e.g. WETH) is collected to this contract and
    ///      left for the owner to handle out of band — this build's rebate is
    ///      USDC-denominated to match `AgentResult.rebate`/`finalUsdc`/`pnl`.
    ///      External + self-call-only so `settle()` can wrap it in `try/catch`
    ///      (Solidity's try/catch only works on external calls).
    function collectHouseFeesInUsdc() external returns (uint256) {
        require(msg.sender == address(this), "internal only");
        (uint256 amount0, uint256 amount1) = positionManager.collect(
            INonfungiblePositionManager.CollectParams({
                tokenId: housePositionTokenId,
                recipient: address(this),
                amount0Max: type(uint128).max,
                amount1Max: type(uint128).max
            })
        );
        address token0 = pool.token0();
        return token0 == address(usdc) ? amount0 : amount1;
    }

    // ---------------------------------------------------------------- spectators

    /// @notice For-fun pick, no money moves. Sybil resistance is Phase 2 (World).
    function submitPick(uint256 matchId, address side) external {
        MatchData storage m = matches_[matchId];
        if (!m.isParticipant[side]) revert UnknownAgent();
        emit PickSubmitted(matchId, msg.sender, side);
    }
}
