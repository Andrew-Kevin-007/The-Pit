# @the-pit/shared

The single source of truth for the **match state model**, shared types, the
**coarse+delayed leader** rule, the **strategy config** shape, and the
**mock-match fixture**. Imported by `web`, `runner`, and `agent`.

| File | Phase | What |
|---|---|---|
| `src/stateModel.ts` | 0 | `MatchStatus` + transitions, `RoundState`, `MatchState`, round/clock math, event→status map |
| `src/leader.ts` | 1 | `coarseLeader()` — bucketed + `LEADER_DELAY_SECONDS` held-back lead signal for the public board |
| `src/strategyConfig.ts` | 0 | `StrategyConfig` + `canonicalConfigString()` for the commit hash |
| `mock-match.json` | 1 | one `MatchState`, `LIVE` at round 2 — drives the board + runner before contracts exist |

```bash
npm install && npm run build
```

Changing the state model = changing an interface four packages depend on.
Do it here, rebuild, and tell the team.
