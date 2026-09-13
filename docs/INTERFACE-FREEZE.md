# Interface Freeze (Day 1)

Everyone attends. Nothing downstream is safe to build until all of this is
locked. After the meeting, changes go through Suganthan.

## 1. Solidity events — Amalraj proposes, Kevin + Suganthan consume

These are what the subgraph indexes and the runner drives off. Placeholder ABIs
matching them already live in
[`packages/subgraph-match/abis`](../packages/subgraph-match/abis).

```solidity
event AgentRegistered(address indexed agent, bytes32 commitHash, uint256 stake, uint256 indexed matchId);
event MatchStarted(uint256 indexed matchId, uint256 startTime, address[] agents);
event RoundLocked(uint256 indexed matchId, uint8 round, address indexed agent, uint256 usdcBalance, uint256 timestamp);
event StrategyRevealed(uint256 indexed matchId, address indexed agent, string config);
event MatchSettled(uint256 indexed matchId, address indexed winner, uint256[] rebateAmounts);
event PickSubmitted(uint256 indexed matchId, address indexed spectator, address side);
```

**From the PitRouter (post-swap callback)** — so Kevin never decodes the pool's generic
`Swap` event:

```solidity
event AgentSwap(uint256 indexed matchId, uint8 round, address indexed agent, int256 amount0, int256 amount1, uint256 feeAccrued);
```

Decisions — **resolved** in `backend/src/MatchController.sol` / `PitRouter.sol`:
- [x] `rebateAmounts[]` order == agent registration order — yes (`settle()` iterates `participants[]` in registration order; `packages/runner`'s `runMatch` already assumed this).
- [x] `RoundLocked` emitted once per agent, or once per round with all balances? — **per agent** (`lockRound()` loops every participant and emits one `RoundLocked` per agent per round; matches the placeholder ABI's single non-array `agent`/`usdcBalance` fields).
- [x] `matchId` type `uint256`, rendered as decimal string for `Match.id` — yes.

## 2. Strategy config JSON — Sylesh defines

Shape: [`packages/shared/src/strategyConfig.ts`](../packages/shared/src/strategyConfig.ts).
Commit = `keccak256(utf8(canonicalConfigString(cfg)) || salt)`. Amalraj checks
this exact preimage on `reveal`.

## 3. Swap call path — Amalraj + Sylesh

- [ ] PitRouter vs. direct v3 pool `swap()` call
- [ ] How the agent's wallet is the `msg.sender` the hook sees
- [ ] Exact calldata the runner/agent builds

## 4. Match state model — Suganthan owns

[`docs/STATE-MODEL.md`](./STATE-MODEL.md). Round index `0..5`, 90s, statuses
`REGISTERING | LIVE | LOCKED | REVEALED | SETTLED`.

## 5. Addresses to circulate once deployed

| Value | Fills into |
|---|---|
| `MatchController` address + deploy block | both subgraphs `networks.json`, `.env` |
| `PitRouter` address + deploy block | `subgraph-match/networks.json`, `.env` (`PIT_ROUTER_ADDRESS`) |
| House pool address (the v3 pool `PitRouter` wraps — no PoolId, v3 pools are their own contract) | `.env` `POOL_ADDRESS`, board, agent |
| Pool contract deploy block | `subgraph-messari/networks.json` `startBlock` |

> Updated during the v4 → v3 migration (`backend/`): there is no hook and no
> singleton `PoolManager`/`PoolId` — v3 pools are individually deployed
> contracts, so "the pool" is just an address, same as `MatchController`/
> `PitRouter`. `packages/shared`'s `MatchState.poolId` comment still says "v4
> PoolId" — that's the one remaining v4 reference this pass didn't touch
> (owned by Suganthan, out of scope for the Kevin/Amalraj tracks — flagged in
> `DELIVERABLES.md`).
