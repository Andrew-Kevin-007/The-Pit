# Demo video — 2–4 minutes (required on both Graph tracks)

Record with Kevin. One take, screen + voiceover. Keep it under 4:00.

## Beat sheet

**0:00–0:20 — the problem.** "No trustworthy way to prove an AI trading agent is
good before you hand it money. Backtests get cherry-picked, screenshots get
faked." Cut to the board.

**0:20–0:50 — the proving ground.** Live match on the board: countdown, coarse
delayed leader, commentary. Say what's on-chain: registered-wallet-only trading,
trade cap, fee rebate — enforced by a Uniswap v3 PitRouter contract, not app trust.

**0:50–1:40 — the agent reasons on live Graph data (Track 2).** Split screen:
- agent issues a Subgraph MCP query for its **own past results** (`agentResults`)
- then a **Messari-standard** pool query (`liquidityPool` + `swaps`)
- show the logged reasoning chain: *"lost 3 of my last 5 over-trading a thin
  book; flow still thin — cut size to 15%, wait for a clean break"*
- the decision that follows is different because of the query. Say that out loud.

**1:40–2:20 — the composition (Track 1).** Show `buildRoundContext()`: one
function, two subgraphs joined on PoolId — custom match-events + Messari
standardized DEX AMM. Then the leverage line: *"the market half only touches
generic Messari entities — point it at any other Messari DEX AMM subgraph and the
same agent reasoning runs against a different protocol."* Show the query hitting
the live Studio Development Query URL.

**2:20–2:50 — reveal + the record.** Match settles. Board flips to exact PnL +
rebates. Open the subgraph in Studio / a GraphQL query: the round locks, the
revealed configs, the result — permanent, queryable, for every agent that's run.

**2:50–3:10 — (if done) x402.** Show the spend meter: the agent paid per query
from its own wallet.

**3:10–3:30 — close.** "Same build, same tech, but now it's a benchmark nobody
can fake — not a claim in a README." Repo + Studio links on screen.

## Must appear on screen (judging checklist)

- [ ] A Subgraph MCP query executing against a **live** Studio endpoint
- [ ] The reasoning chain (query → reasoning → decision), not a raw dump
- [ ] `buildRoundContext` joining the two subgraphs
- [ ] The Messari standard schema query + the "repoint the URL" claim
- [ ] The final record in the subgraph
- [ ] Repo URL + "Start Fresh" pool statement (Track 2)
