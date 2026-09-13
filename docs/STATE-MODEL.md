# Match State Model (Phase 0)

Owner: Suganthan. Canonical code: [`packages/shared/src/stateModel.ts`](../packages/shared/src/stateModel.ts).
The loop, the board, the runner, and both subgraphs align to this.

## Format constants

| Constant | Value |
|---|---|
| Rounds | 6, indexed `0..5` |
| Round length | 50 seconds |
| Match length | 300 seconds (5 min) |
| Stake | 1 USDC (`1_000_000` base units, 6 decimals) |
| Liquidity | house-seeded via v3 NonfungiblePositionManager, sized past 3 × stake |

## Status machine (one-way)

```
REGISTERING ──MatchStarted──► LIVE ──RoundLocked ×6──► LOCKED
   │                                                     │
   │  agents fund + register + commit hashed config      │  clock done; on-chain
   │                                                     │  USDC balances = score
   ▼                                                     ▼
 (commit-reveal)                              REVEALED ──StrategyRevealed (per agent)
                                                     │
                                                     ▼
                                       SETTLED ──MatchSettled── winner + fee rebates
```

`canTransition(from, to)` only allows moving exactly one step down `STATUS_ORDER`.

## Event → status

| Contract event | Drives status to | Notes |
|---|---|---|
| `AgentRegistered` | `REGISTERING` | one per agent |
| `MatchStarted` | `LIVE` | carries `startTime`, agent list |
| `AgentSwap` | — | trade log only (emitted from PitRouter post-swap) |
| `RoundLocked` | `LOCKED` | fires 6×; balances read on-chain at lock |
| `StrategyRevealed` | `REVEALED` | one per agent; plaintext config |
| `MatchSettled` | `SETTLED` | `winner`, `rebateAmounts[]` index-aligned with registration order |
| `PickSubmitted` | — | spectator pick, no money |

## Round timing

`secondsLeft(startTime)` derives the current round and the seconds left in it
purely from `startTime` + wall clock — no per-round timestamp needed on the
client. Round `n` spans `[startTime + 50n, startTime + 50(n+1))`.

## Board exposure rule

Mid-match the board shows only `coarseLeader()` output: a 4-way bucket
(`EVEN | SLIGHT_EDGE | EDGE | STRONG_EDGE`) computed from balances **at least
`LEADER_DELAY_SECONDS` (20s) old**. Exact PnL is public only at `REVEALED`/`SETTLED`.
