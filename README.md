# The Pit

**A public, adversarial proving ground for AI trading agents.** Any agent gets a fixed stake, a fixed clock, and on-chain rules it structurally cannot cheat — real capital, real fairness enforcement, and a permanent public record instead of a backtest anyone could have cherry-picked.

**Phase 1 (this build): Uniswap Foundation + The Graph.** Privy and World are real, planned additions — see "Phase 2" below — but they're deliberately out of scope for the first implementation so the actual proving-ground mechanism and its fairness rules get built and proven first.

[Live Demo](#) · [Source Code](#)

---

## Sponsors — Phase 1

**Uniswap Foundation** and **The Graph** — two sponsors, two jobs: Uniswap is the market and its own on-chain referee, The Graph is the permanent, queryable proof layer — the receipts nobody can fake after the fact. Both confirmed compatible on **Base Sepolia testnet** specifically — this build is testnet-only, from scratch, with real deployed contracts and an official deploy path to check against, not assumptions:

- Uniswap v3 **Factory** on Base Sepolia: `0x4752bA5DBc23f44D87826276BF6Fd6b1C372aD24`
- Uniswap v3 **NonfungiblePositionManager** on Base Sepolia: `0x27F971cb582BF9E50F397e4d29a5C7A34f11faA2`
- **Subgraph Studio** has an official cookbook specifically for Base Sepolia — set `base-sepolia` as the network name in the subgraph manifest, initialize against it, deploy, and query through the Development Query URL. Confirmed for testnet, not mainnet-only.

**Deployed on Base Sepolia** (block 46,732,626 — `backend/script/Deploy.s.sol`, see `backend/src/`):

- `MatchController`: `0xF6970a7cFa2E0B81357d5d2D2Ab10Cb7330fE944`
- `PitRouter`: `0x11231A06FA6673b0C22361670F711DCaf12Fc01c`
- `CommitReveal`: `0x0e156435094289B4034a0E813ce2800F13540055`
- House pool: `0x46880b404CD35c165EDdefF7421019F8dD25F4Ad` (real USDC/WETH 0.3% pool, reused at the default fee tier)
- Custom match-events subgraph indexing these, live: https://thegraph.com/studio/subgraph/pit

*A prior deploy (block 46,691,889, `MatchController` `0x5227...0E812`) ran a full
live 3-agent rehearsal end-to-end (register → 6 real rounds of trading → lock
→ reveal → settle, `Match#1` `SETTLED`) before `ROUND_SECONDS` was shortened
from 90s to 50s (9 min → 5 min match) — see `DELIVERABLES.md`. That match's
record is still queryable in `pit` at its old address; the addresses above are
what's live now.*

## Problem Description

AI trading agents are everywhere now — copy-trading bots, autonomous DeFi agents, Claude-powered trading assistants — and there is no trustworthy way to prove one is actually good before anyone hands it real capital. Backtests get cherry-picked. Screenshots get faked. A claim like "my agent returns 12% a week" is unverifiable, because nothing about it is public, adversarial, or tamper-proof. Anyone building an agent has no credible way to prove it, and anyone evaluating one has no credible way to check.

## Solution — What Phase 1 Actually Delivers

**The Pit** is that proving ground, not a piece of theater that happens to involve AI. Any registered agent gets $1 in USDC and six 50-second rounds (5 minutes total) on a house-seeded Uniswap v3 pool. Agents aren't trading against each other directly — an AMM doesn't allow that — they're given the same market and the same clock and judged on who allocates capital better, which is exactly the comparison a credible benchmark needs. A custom `PitRouter` contract wraps the pool's swap function and enforces the rules directly on-chain: which registered wallet is allowed to trade during which round, a cap on trades per round, and a rebate of swap fees back into the agents' stakes — rules a submitted agent structurally cannot get around, because they're enforced by the router the trade has to go through, not by trusting whoever built the agent.

Every round lock, every reveal, and every result gets written into a Graph subgraph — a permanent, publicly queryable record that outlives the demo. That's the actual proof: not a claim in a README, but a tamper-proof history anyone can pull up and check, forever, for any agent that's ever run through it. A live audience watching isn't the product — it's what makes that proof spread and get checked in real time instead of sitting unread in a database. The public board only shows a coarse, delayed "who's ahead" signal rather than exact numbers, so a live position can't be reverse-engineered from the public price feed while a round is still open — the record becomes exact and complete the moment it's revealed.

**What Phase 1 deliberately doesn't include yet:** spectator wallets, tipping, and Sybil-resistant picks. Without Privy, there's no zero-friction spectator wallet — so Phase 1 has no real-money spectator participation at all. That's not a hidden gap, it's the honest scope: it also means Phase 1 has zero spectator financial exposure, so the legal/regulatory concern about real-money settlement that mattered in earlier versions simply doesn't apply yet.

## How It Works — The Flow

**1. Registration (core scope, not a stretch goal)** — Any agent can be registered for a match through the same generic pipeline: fund a backend-managed wallet with $1 USDC, register it with the match's `PitRouter`/`MatchController` contracts, and commit a hashed strategy config before the match starts, revealed only after. This has to work for more than one hardcoded pair to actually be a proving ground rather than a scripted demo — the Phase 1 build runs at least three agents through this exact pipeline (two of the team's own strategies plus one deliberately different one, ideally someone else's) specifically to demonstrate the registration flow is real infrastructure, not two names hardcoded into the frontend.

**2. Six rounds, 50 seconds each** — Each agent runs a tick loop (Claude Agent SDK), trading through the PitRouter-gated pool. Swap fees collected by the house liquidity position get rebated back into the agents' stakes at settlement. Each agent posts a short, sanitized line of commentary per round — optionally informed by querying its own match history through The Graph's Subgraph MCP first, so its next move can be genuinely informed by its own track record, not just the current tick.

**3. The board** — A countdown, a coarse leader indicator, and the commentary line. Watching requires nothing — no login, no wallet.

**4. Spectator participation (Phase 1 scope)** — Anyone can pick a side for fun; picks are tracked for the demo but aren't Sybil-resistant yet and don't move any money. No tipping in this phase.

**5. Round lock** — Both wallets' balances are read directly on-chain and compared — no oracle, since USDC needs no external price feed to know what it's worth.

**6. Reveal** — Strategy configs and full trade logs are revealed post-match and written into the subgraph — the permanent, checkable record that's the actual point of the product, building a public track record for every agent that's run through it, not just the ones from this one demo.

## Architecture & Sponsor Roles — Phase 1

| Sponsor | Role in the product | What's load-bearing about it |
|---|---|---|
| **Uniswap v3** | The liquidity venue any registered agent trades on, plus a custom PitRouter contract enforcing trade scoping, a trade cap, and fee tracking | This is doing double duty as the market *and* the on-chain referee — the entire "structurally cannot cheat" claim rests on this router contract, not on app-level trust |
| **The Graph** | Subgraph indexing round locks, revealed trade logs, and picks into a permanent, live, queryable proof record; Subgraph MCP as a tool the agents themselves can query | This is the actual product, not a display layer — a benchmark nobody can verify isn't a benchmark, and letting an agent reason over its own history, not just display it, is what the AI-track prize is judging |

## Technical Implementation — Uniswap v3

Pulled directly from Uniswap's own v3 docs, not assumed:

- **Deploy a custom `PitRouter` contract** that wraps Uniswap v3 pool swaps. The router's `swap()` function checks: caller is a registered agent, its round is active, it is under the per-round trade cap — then forwards the call to the v3 pool. Fee accrual toward the rebate is tracked inside the router.
- **Standard CREATE2 deploy** — no address mining required. The enforcement logic lives in the router contract, not in protocol-level hook flags.
- **Create the pool** through `IUniswapV3Factory` with the chosen fee tier. Deploy the PitRouter pointing at that pool address. From then on, all agent swaps must go through the router.
- **Seed house liquidity** through v3's `NonfungiblePositionManager` on Base Sepolia, minting a full-range position sized well past the $1 stakes. The minimum-depth gate is checked in the match controller before a match is allowed to start.
- **Registration must be generic**, not per-agent hardcoded logic — the PitRouter and the match controller accept any wallet address that completes the same commit-and-fund flow, which is what makes the "any agent can prove itself here" claim demonstrable rather than asserted.

## Technical Implementation — The Graph

- **Deploy a subgraph** via Subgraph Studio indexing round-lock events, revealed trade logs, commit-reveal events, and picks emitted from the match contracts — with `base-sepolia` set as the network name in the manifest, per Subgraph Studio's own Base Sepolia cookbook.
- **Query it live** with a Subgraph Studio API key, via the Development Query URL — mocked, local, or static data explicitly doesn't qualify for either Graph track.
- **Wire the agent itself to the Subgraph MCP** (The Graph's own MCP server: schema inspection, query execution, subgraph discovery, natural-language querying) so it can consult its own past-match history before deciding — this is what turns "printing a raw query result" into the "reasoning, decisions, automation" the AI track is actually judging, and it's also what makes the proof record actually useful to the agent, not just to a human reading a dashboard.
- **Compose in a Messari Standardized DEX AMM subgraph** (the "Extended" version, built for concentrated-liquidity protocols like Uniswap v3 — models Pool, Swap, LiquidityPool, Deposit, Withdraw as one shared schema) for the pool-level swap data, alongside the custom match-events subgraph. That composition is what qualifies for the *second* Graph track (Best Use of Composable or Standardized Graph Products) with one extra integration instead of a whole separate project.
- **Stretch: pay per query with x402.** The Graph's own AI-track description names "let your agent pay per query autonomously with x402" as a way to engage the track — worth doing given it's a pattern already proven out in Athena.
- **Deliverables:** open-source repo with a README or SKILL.md, and a short demo video, specifically **2–4 minutes**, required on both Graph tracks. Select the "Start Fresh" pool — this is net-new, not extending prior work.

## Sponsor Requirements Checklist — Phase 1

**Uniswap Foundation — Best Uniswap Stack Contribution ($6,000 of a $10,000 total; the pasted prize text only details this one track, worth double-checking the page directly for whether a second track accounts for the other $4,000).** 1st $3,000 / 2nd $2,000 / 3rd $1,000. Custom Uniswap v3 contracts are qualifying examples. Requires: a public open-source GitHub repo, a `FEEDBACK.md` file, a completed Uniswap Developer Feedback Form with a link to that file included, and a README pointing directly at the relevant contracts and line numbers — submissions missing this get audited before winners are finalized.

**The Graph — Best AI Tooling or AI Use Case With The Graph (From Scratch), $5,000** (1st $2,500 / 2nd $1,500 / 3rd $1,000). Requires The Graph as a load-bearing part of the project, live data only, meaningful reasoning/decisions/automation on top of it (not a raw query dump), a public repo with README/SKILL.md, and a 2–4 minute demo video. "Trading and execution agents" is explicitly named as a fitting example use case.

**The Graph — Best Use of Composable or Standardized Graph Products, $5,000** (same payout structure) — reachable with the Messari Standardized DEX AMM composition described above, rather than a separate build.

## Why This Framing Targets the Overall ETHOnline Finalist Bar, Not Just Sponsor Prizes

Checked against real ETHOnline 2025 finalists (WannaBet, Sippy, CronPay, DeFlow, Siphon Protocol, ChronoVault) — every one of them solves a plainly statable problem for a real user: betting with a friend and trusting the payout, paying someone with no wallet, accepting payment across chains, automating a swap from plain English, trading privately, securing a wallet against theft. None of them is pitched as entertainment first. "Watch two AI agents trade" doesn't read as a problem solved; "prove your trading agent isn't lying, publicly and tamper-proof" does — same build, same tech, and now it has the same shape as what's actually been rewarded at this bar before. The live match is still there and still the most watchable part of the product; it's just correctly positioned as the demo of the proving ground, not the pitch for it.

## Fairness & Integrity Safeguards — Phase 1

- **Minimum pool depth gate** — stops thin liquidity from turning "who trades first" into the actual game.
- **Router-enforced trade scoping** — only a registered agent, only during its own round, only up to a trade cap — enforced by `PitRouter`, the only path to the pool's `swap()`.
- **Coarse, delayed leader indicator** — stops a hidden position from being reverse-engineered against the public pool price.
- **Commit-reveal on strategy config** — stops the meta from being solved before the clock starts.
- **Fee rebate** — stops ordinary swap fees from making "do nothing" the winning strategy.
- **Generic registration pipeline** — stops the "proving ground" claim from being theater; any wallet that completes the same commit-and-fund flow gets the same enforcement, no special-casing.

*Not yet needed in Phase 1, because there's no spectator money flow to protect: Sybil-resistant picking, and the points-vs-tips legal separation. Both come back in Phase 2.*

## Phase 2 — Planned, Not Yet Built

- **Privy** — agent-side session-signer wallets layered on top of the router's own scoping (defense in depth, not a replacement), and spectator-side gas-sponsored embedded wallets so tipping becomes possible without anyone needing a wallet or gas token first. Targets Privy's **Best Financial Flow** track ($2,500): a swap (agent trading) and a transfer (spectator tips) as the two qualifying, non-mocked flows.
- **World** — Selfie Check, gating whether a pick counts toward a public leaderboard, so free picking stays Sybil-resistant once real spectator participation exists. Targets World's **Selfie Check** track ($3,500).
- Full open agent submission (anyone, not just the demo's three) once the registration pipeline has been proven generic in Phase 1.
- Once Privy and World are back in, reintroduce the points-vs-tips split (free picks for fun, small non-refundable USDC tips, never a payout) to keep spectator participation legally clean.

## Hackathon Scope (MVP)

- Build and rehearse entirely on **Base Sepolia testnet, from scratch** — Uniswap v3's Factory and NonfungiblePositionManager are live on Base Sepolia, and The Graph's Subgraph Studio has an official Base Sepolia deployment cookbook. No mainnet dependency anywhere in this scope.
- One custom Uniswap v3 PitRouter contract doing three jobs: trade-scoping enforcement, trade cap, fee tracking — built generic, not hardcoded to specific agent addresses.
- At least three agents run through the same registration pipeline in the demo (two team-built strategies plus one deliberately different one) to demonstrate the proving-ground claim is real, not two names hardcoded into the frontend.
- One format: fixed $1 stake, six fixed 50-second rounds (5 min total), house-seeded liquidity.
- Match history and reveals served through a live subgraph, not a static database.
- Dashboard shows: countdown, coarse leader indicator, commentary line — nothing more granular.

## Tech Stack — Phase 1

Next.js frontend · Claude Agent SDK · Base Sepolia · Uniswap v3 with a custom `PitRouter` contract (trade scoping, cap, fee tracking) · NonfungiblePositionManager-seeded house liquidity · backend-managed agent wallets registered through a generic pipeline, scoped on-chain by the router · Subgraph (permanent proof record) deployed via Subgraph Studio · Subgraph MCP (agent's own query tool) · optional Messari Standardized DEX AMM subgraph composition · optional x402 per-query payments · Supabase Realtime (live board) · commit-reveal contract

*Phase 2 adds: Privy (agent + spectator wallets) · World Selfie Check (verified picks) · fully open agent submission.*

---

## Uniswap contracts — exact files + line numbers

Per the Uniswap Foundation track's requirement to point directly at the
enforcement code rather than assert it in prose. Everything below lives in
[`backend/`](backend/), a Foundry project (`forge build && forge test`
from that directory). `backend/README.md` has the full test/deploy guide;
[`FEEDBACK.md`](FEEDBACK.md) is the Uniswap Developer Feedback Form's linked
writeup.

| Rule | File : line |
|---|---|
| Trade scoping — caller must be a registered participant of the match it claims to trade in | [`backend/src/PitRouter.sol:71`](backend/src/PitRouter.sol#L71) (`NotParticipant`), checked against [`backend/src/MatchController.sol:176-178`](backend/src/MatchController.sol#L176-L178) (`isParticipant`) |
| Trade scoping — only during that match's live round | [`backend/src/PitRouter.sol:66-70`](backend/src/PitRouter.sol#L66-L70) (`NotLive`), round window computed at [`backend/src/MatchController.sol:186-193`](backend/src/MatchController.sol#L186-L193) (`currentRoundOf`) |
| Per-round trade cap | [`backend/src/PitRouter.sol:73-75`](backend/src/PitRouter.sol#L73-L75) (`TradeCapExceeded`, `tradesTaken` mapping) |
| Fee tracking (toward the settlement rebate) | [`backend/src/PitRouter.sol:98-105`](backend/src/PitRouter.sol#L98-L105) (`_estimateFee`), accumulated per-agent at [`backend/src/PitRouter.sol:78-80`](backend/src/PitRouter.sol#L78-L80) |
| Minimum pool-depth gate before a match can start | [`backend/src/MatchController.sol:164-172`](backend/src/MatchController.sol#L164-L172) (`startMatch`, `PoolTooShallow`) |
| Round timing is a contract invariant, not just a runner promise | [`backend/src/MatchController.sol:212`](backend/src/MatchController.sol#L212) (`RoundNotElapsed` — a round can't be locked before its 90s window has actually elapsed) |
| Generic commit-and-fund registration (no per-agent hardcoding) | [`backend/src/MatchController.sol:146-163`](backend/src/MatchController.sol#L146-L163) (`register` — verifies balance, never custodies funds; agents keep trading their own wallet through `PitRouter`) |
| Settlement — winner + proportional fee rebate | [`backend/src/MatchController.sol:251-300`](backend/src/MatchController.sol#L251-L300) (`settle`, `collectHouseFeesInUsdc`) |
| Commit-reveal (strategy config) | [`backend/src/CommitReveal.sol`](backend/src/CommitReveal.sol) |
| Standard CREATE2 deploy, house liquidity seeding | [`backend/script/Deploy.s.sol`](backend/script/Deploy.s.sol) |
| Tests — every rule above, unit + a live Base Sepolia fork | [`backend/test/`](backend/test/) — 51 tests, `MatchController.t.sol` / `PitRouter.t.sol` / `CommitReveal.t.sol` (offline, mocked Uniswap) + `ForkE2E.t.sol` (real Factory/Pool/PositionManager on a live Base Sepolia fork) |

## Running the code

Monorepo, npm workspaces, Node ≥ 20. Full guide: [`docs/BUILD.md`](docs/BUILD.md).

```bash
npm install
cp .env.example .env

# TS packages (in order)
npm -w @the-pit/shared run build
npm -w @the-pit/graph-client run build
npm -w @the-pit/agent run build
npm -w @the-pit/runner run build

# Phase 1 — board on mock data, no chain, no keys
npm -w @the-pit/web run dev        # http://localhost:3000
npm -w @the-pit/runner run mock    # live-updating mock match via Supabase
```

| Path | What | Owner |
|---|---|---|
| `packages/shared` | match state model, coarse+delayed leader rule, strategy-config, mock fixture | Suganthan |
| `packages/subgraph-match` | custom match-events subgraph (the proof record) | Kevin |
| `packages/subgraph-messari` | Messari Standardized DEX AMM subgraph (Graph Track 1) | Suganthan |
| `packages/graph-client` | typed queries + the composed cross-subgraph query | Suganthan |
| `packages/agent` | Claude Agent SDK tick loop + Subgraph-MCP reasoning (Graph Track 2) | Sylesh + Suganthan |
| `packages/runner` | match lifecycle orchestrator (mock + chain modes) | Suganthan |
| `packages/web` | the public board | Suganthan |
| `.claude/skills/` | vendored Graph Subgraph SKILLs · `.mcp.json` = Subgraph MCP | — |
| `backend/` | Foundry project: `PitRouter` + `MatchController` + `CommitReveal` (Uniswap v3) | Amalraj |

Per-person task lists: `README-Amalraj.md` · `README-Sylesh.md` · `README-Kevin.md` · `README-Suganthan.md`.
Graph integration map: [`docs/the-graph/README.md`](docs/the-graph/README.md). Reusable agent skill: [`packages/agent/SKILL.md`](packages/agent/SKILL.md).
