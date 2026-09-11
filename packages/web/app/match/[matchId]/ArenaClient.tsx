"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { coarseLeader, type MatchState } from "@the-pit/shared";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { AgentCard } from "@/components/AgentCard";
import { RoundClock } from "@/components/RoundClock";
import { LeaderBar } from "@/components/LeaderBar";
import { MatchStatusChip } from "@/components/MatchStatusChip";
import { CommentaryLine } from "@/components/CommentaryLine";
import { FighterSelect } from "@/components/FighterSelect";
import { PitNav } from "@/components/PitNav";

export default function ArenaClient({ matchId, initial }: { matchId: string; initial: MatchState }) {
  const [state, setState] = useState<MatchState>(initial);

  // realtime + poll fallback — same pattern as the original BoardClient.
  useEffect(() => {
    const sb = supabaseBrowser();
    let channel: ReturnType<NonNullable<typeof sb>["channel"]> | null = null;
    if (sb) {
      channel = sb
        .channel(`board:${matchId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "board_state", filter: `match_id=eq.${matchId}` },
          (payload) => {
            const next = (payload.new as { state?: MatchState })?.state;
            if (next) setState(next);
          },
        )
        .subscribe();
    }
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`/api/board/${matchId}`, { cache: "no-store" });
        if (r.ok) setState(await r.json());
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => {
      if (sb && channel) sb.removeChannel(channel);
      clearInterval(poll);
    };
  }, [matchId]);

  const left = state.agents[0] ?? null;
  const right = state.agents[1] ?? null;

  const lastLocked = useMemo(() => {
    const locked = [...state.rounds].reverse().find((r) => r.lockedAt && Object.keys(r.balances).length >= 2);
    if (!locked) return null;
    return coarseLeader(locked.balances, locked.lockedAt!, Date.now() / 1000);
  }, [state]);

  const tradeCountThisRound = (wallet: string) => {
    const current = state.rounds.find((r) => r.index === state.currentRound);
    return current?.trades[wallet] ?? 0;
  };

  const latestCommentary = useMemo(() => {
    const round = [...state.rounds].reverse().find((r) => Object.keys(r.commentary).length > 0);
    if (!round) return [];
    return Object.entries(round.commentary);
  }, [state]);

  return (
    <main className="pit-scanlines min-h-screen bg-pit-black px-4 py-8">
      <PitNav matchId={matchId} />
      <div className="mx-auto mt-4 flex max-w-3xl justify-center">
        <MatchStatusChip status={state.status} />
      </div>

      {/* Fighter HUD */}
      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 items-center gap-4 sm:grid-cols-3">
        <div>
          {left && (
            <AgentCard
              handle={left.handle}
              side="left"
              statLine={`${tradeCountThisRound(left.wallet)} trades this round`}
            />
          )}
        </div>
        <RoundClock startTime={state.startTime} status={state.status} />
        <div>
          {right && (
            <AgentCard
              handle={right.handle}
              side="right"
              statLine={`${tradeCountThisRound(right.wallet)} trades this round`}
            />
          )}
        </div>
      </div>

      {/* Arena panel */}
      <div className="mx-auto mt-8 max-w-3xl rounded-xl border border-pit-border bg-pit-surface p-6">
        <LeaderBar
          bucket={lastLocked?.bucket ?? null}
          ahead={
            lastLocked?.ahead
              ? lastLocked.ahead.toLowerCase() === left?.wallet.toLowerCase()
                ? "left"
                : "right"
              : null
          }
          asOf={lastLocked?.asOf ?? null}
        />
        <div className="mt-6 flex justify-center gap-3">
          {state.rounds.map((r) => {
            const isCurrent = state.currentRound === r.index;
            const done = !!r.lockedAt;
            let dotClass = "border-pit-dim";
            if (done && left && right) {
              const lb = r.balances[left.wallet];
              const rb = r.balances[right.wallet];
              if (lb && rb) {
                if (BigInt(lb) > BigInt(rb)) dotClass = "bg-pit-green border-pit-green";
                else if (BigInt(rb) > BigInt(lb)) dotClass = "bg-pit-red border-pit-red";
                else dotClass = "bg-pit-dim border-pit-dim";
              }
            }
            return (
              <div
                key={r.index}
                className={`h-3 w-3 rounded-full border-2 ${dotClass} ${
                  isCurrent ? "animate-pulse-yellow border-pit-yellow" : ""
                }`}
                title={`Round ${r.index + 1}`}
              />
            );
          })}
        </div>
      </div>

      {/* Audience zone */}
      <div className="mx-auto mt-8 max-w-3xl space-y-6">
        <div className="space-y-2 rounded-xl border border-pit-border bg-pit-surface p-6">
          {latestCommentary.length > 0 ? (
            latestCommentary.map(([wallet, text]) => {
              const isLeft = !!left && wallet.toLowerCase() === left.wallet.toLowerCase();
              const handle =
                state.agents.find((a) => a.wallet.toLowerCase() === wallet.toLowerCase())?.handle ??
                wallet.slice(0, 8);
              return <CommentaryLine key={wallet} handle={handle} text={text} side={isLeft ? "left" : "right"} />;
            })
          ) : (
            <p className="font-mono text-xs uppercase tracking-wider text-pit-dim">
              no commentary yet — match hasn&apos;t started
            </p>
          )}
        </div>

        {state.status !== "SETTLED" && left && right && (
          <div className="rounded-xl border border-pit-border bg-pit-surface p-6">
            <p className="mb-3 text-center font-mono text-xs uppercase tracking-wider text-pit-dim">
              pick a side — for fun, no wallet, moves no money
            </p>
            <FighterSelect
              matchId={matchId}
              agents={[
                { wallet: left.wallet, handle: left.handle, side: "left" },
                { wallet: right.wallet, handle: right.handle, side: "right" },
              ]}
            />
          </div>
        )}

        {(state.status === "REVEALED" || state.status === "SETTLED") && (
          <div className="text-center">
            <Link
              href={`/match/${matchId}/result`}
              className="inline-block rounded-md border border-pit-yellow px-4 py-2 font-mono text-xs uppercase tracking-widest text-pit-yellow hover:bg-pit-yellow/10"
            >
              view full result &rarr;
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
