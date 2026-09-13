-- The Pit — Supabase schema.
-- Run this once in the Supabase SQL Editor (Project -> SQL Editor -> New query)
-- for https://lbswcfizdazlgtxzpdpv.supabase.co, then paste + run.
--
-- Nothing here is sensitive: MatchController on Base Sepolia is the real
-- source of truth (and the subgraph the tamper-proof record of it). These
-- tables are a fast, realtime mirror/cache in front of that — so RLS is
-- permissive by design, same trust model as the on-chain submitPick()
-- (public, ungated, "for fun" per its own docstring).

-- board_state — the runner pushes a full MatchState snapshot after every
-- transition; the web board subscribes via Supabase Realtime for instant
-- updates instead of waiting on 8s polling / subgraph indexing.
create table if not exists board_state (
  match_id text primary key,
  state jsonb not null,
  updated_at timestamptz not null default now()
);
alter table board_state enable row level security;
drop policy if exists "board_state read" on board_state;
create policy "board_state read" on board_state for select using (true);
drop policy if exists "board_state write" on board_state;
create policy "board_state write" on board_state for insert with check (true);
drop policy if exists "board_state update" on board_state;
create policy "board_state update" on board_state for update using (true) with check (true);

-- picks — spectator "who do you think wins", one row per (match, client).
-- Not Sybil-resistant by design (see README "for fun, no wallet needed");
-- the real, on-chain pick record is MatchController.submitPick() via MetaMask.
-- This table is just for a fast "N picks cast" counter without waiting on
-- subgraph indexing.
create table if not exists picks (
  id bigint generated always as identity primary key,
  match_id text not null,
  side text not null,
  client_id text not null,
  created_at timestamptz not null default now(),
  unique (match_id, client_id)
);
alter table picks enable row level security;
drop policy if exists "picks read" on picks;
create policy "picks read" on picks for select using (true);
drop policy if exists "picks write" on picks;
create policy "picks write" on picks for insert with check (true);

-- agent_benchmarks — a per-agent, per-match performance snapshot written the
-- instant a match settles (by the runner), so it's queryable/realtime long
-- before the subgraph finishes indexing MatchSettled. The subgraph stays the
-- tamper-proof record; this is the fast benchmark view in front of it.
create table if not exists agent_benchmarks (
  id bigint generated always as identity primary key,
  match_id text not null,
  agent text not null,
  handle text,
  strategy text,
  final_usdc bigint not null,
  pnl bigint not null,
  rebate bigint not null default 0,
  won boolean not null,
  trades_total int not null default 0,
  settled_at timestamptz not null default now(),
  unique (match_id, agent)
);
alter table agent_benchmarks enable row level security;
drop policy if exists "agent_benchmarks read" on agent_benchmarks;
create policy "agent_benchmarks read" on agent_benchmarks for select using (true);
drop policy if exists "agent_benchmarks write" on agent_benchmarks;
create policy "agent_benchmarks write" on agent_benchmarks for insert with check (true);

-- enable Realtime on the two tables viewers subscribe to live
alter publication supabase_realtime add table board_state;
alter publication supabase_realtime add table agent_benchmarks;
