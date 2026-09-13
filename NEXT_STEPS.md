# The Pit — status & what's left

## Done

- **Contracts** — `MatchController`, `PitRouter`, `CommitReveal` deployed for real on Base
  Sepolia (redeployed twice: to change the stake $50→$1, then the round length 90s→50s).
- **Rehearsals** — two full live, on-chain runs (register → trade → lock → reveal → settle)
  with real funded agent wallets, both verified end-to-end via the deployed subgraph.
- **Subgraphs** — `pit` (match/round/agent events) and `pit-messari` (Uniswap v3 pool
  activity) both deployed and indexing on Subgraph Studio.
- **`@the-pit/graph-client`** — typed queries for agent history/trades, match board,
  strategy reveals, leaderboard, and global stats.
- **Frontend (`frontend/`)** — all 6 pages built using the existing component library
  (shadcn/ui primitives, same theme/fonts, nothing about the existing components or styles
  changed) and wired to real data (subgraph first, Supabase second, mock fixture last):
  - `/` — lobby
  - `/match/[matchId]` — live arena
  - `/match/[matchId]/result` — scorecard, strategy reveal, round-by-round, subgraph proof
  - `/agents/[address]` — agent dossier
  - `/leaderboard` — hall of records
  - `/enter` — how to enter
  - Verified against the live subgraph: match #1's real winner/result/round data renders
    correctly (fixed a bug along the way — `liveBoard()` wasn't fetching `winner`/`results`
    from the subgraph at all, so the result page always said "match in progress" even for a
    settled match).
- **`frontend/.env.local`** — wired with the real subgraph URLs + contract addresses (this
  file is gitignored, not pushed).

## Left to do

1. **Supabase is unconfigured** (`NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` / `SUPABASE_SERVICE_KEY`
   are blank in root `.env`). Without it: no realtime board push (8s polling fallback still
   works) and spectator "pick a side" won't persist. Either stand up a real Supabase project
   with `board_state` + `picks` tables, or accept subgraph-poll-only for the demo.
2. **Run a few more real matches.** Only 1–2 have settled so far, so `/leaderboard`'s
   3-match qualifier currently shows "no qualifying agents." Either run more matches before
   demo day, or lower `QUALIFY_MIN_MATCHES` in `frontend/app/leaderboard/page.tsx` for the
   demo.
3. **Deploy the frontend** (Vercel — root directory `frontend`, `next build`) so there's a
   public URL, and add the same env vars there.
4. **Decide on the unused `packages/web` pages** — an earlier pass built a parallel page set
   there under a wrong assumption about which frontend to use. They're dead code now (not
   routed to, not deleted). Say the word and they come out.
5. **ETHGlobal submission itself** — demo video, project description, track selection on
   the submission form. Manual steps outside this repo.

## Not blocking, low priority

- `frontend/` carries both `package-lock.json` and `pnpm-lock.yaml` — harmless but worth
  picking one lockfile eventually.
