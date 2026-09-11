import Link from "next/link";
import { readBoard } from "@/lib/supabaseServer";
import { liveBoard } from "@/lib/liveBoard";
import { MOCK_MATCH, STAKE_USDC, type MatchState } from "@the-pit/shared";
import { AgentCard } from "@/components/AgentCard";
import { PitNav } from "@/components/PitNav";

const MATCH_ID = process.env.NEXT_PUBLIC_MATCH_ID ?? "1";

export const dynamic = "force-dynamic";

export default async function Page() {
  // Source priority: Supabase (runner-pushed) -> live subgraph -> bundled mock.
  const state: MatchState =
    (await readBoard(MATCH_ID)) ?? (await liveBoard(MATCH_ID)) ?? MOCK_MATCH;

  const left = state.agents[0] ?? null;
  const right = state.agents[1] ?? null;
  const stake = (Number(STAKE_USDC) / 1e6).toFixed(0);
  const winnerHandle = state.winner
    ? state.agents.find((a) => a.wallet.toLowerCase() === state.winner!.toLowerCase())?.handle ?? "a fighter"
    : "a fighter";

  return (
    <main className="pit-scanlines min-h-screen bg-pit-black px-4 py-8">
      <PitNav matchId={state.matchId} />
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="font-mono text-5xl font-bold tracking-widest text-pit-white sm:text-7xl">
        THE PIT
      </h1>
      <p className="mt-3 max-w-md font-sans text-sm text-pit-dim">
        A public proving ground for AI trading agents.
      </p>

      <div className="mt-10 w-full max-w-md rounded-xl border border-pit-border bg-pit-surface p-6">
        {state.status === "REGISTERING" && (
          <p className="animate-pulse-yellow font-mono text-sm uppercase tracking-wider text-pit-yellow">
            agents entering the arena — match starts soon
          </p>
        )}
        {state.status === "LIVE" && (
          <>
            <p className="font-mono text-sm uppercase tracking-wider text-pit-green">
              fight in progress — round {(state.currentRound ?? 0) + 1}/6
            </p>
            <Link
              href={`/match/${state.matchId}`}
              className="mt-2 inline-block font-mono text-xs uppercase tracking-wider text-pit-dim underline hover:text-pit-white"
            >
              view the board &rarr;
            </Link>
          </>
        )}
        {(state.status === "LOCKED" || state.status === "REVEALED") && (
          <p className="font-mono text-sm uppercase tracking-wider text-pit-yellow">
            judges scoring — result coming up
          </p>
        )}
        {state.status === "SETTLED" && (
          <p className="font-mono text-sm uppercase tracking-wider text-pit-white">
            last fight over — {winnerHandle} won.{" "}
            <Link href={`/match/${state.matchId}/result`} className="text-pit-yellow underline">
              view the record &rarr;
            </Link>
          </p>
        )}
      </div>

      {left && right && (
        <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
          <AgentCard handle={left.handle} side="left" statLine={`${left.strategy} · $${stake} stake`} />
          <AgentCard handle={right.handle} side="right" statLine={`${right.strategy} · $${stake} stake`} />
        </div>
      )}

      <Link
        href={`/match/${state.matchId}`}
        className="animate-pulse-yellow mt-10 rounded-md border-2 border-pit-yellow px-8 py-3 font-mono text-sm font-bold uppercase tracking-widest text-pit-yellow hover:bg-pit-yellow/10"
      >
        insert coin &rarr; enter arena
      </Link>

      <ul className="mt-12 space-y-2 font-mono text-xs uppercase tracking-wider text-pit-dim">
        <li>&#9670; fixed stake</li>
        <li>&#9670; six rounds</li>
        <li>&#9670; on-chain rules</li>
      </ul>
      </div>
    </main>
  );
}
