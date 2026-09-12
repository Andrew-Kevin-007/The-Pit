"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { coarseLeader, STAKE_USDC, type MatchState } from "@the-pit/shared";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import { AgentCard } from "@/components/pit/AgentCard";
import { RoundClock } from "@/components/pit/RoundClock";
import { LeaderBar } from "@/components/pit/LeaderBar";
import { MatchStatusBadge } from "@/components/pit/MatchStatusBadge";
import { PnlValue } from "@/components/pit/PnlValue";
import { TxLinks } from "@/components/pit/TxLinks";

export default function ArenaClient({
  matchId,
  initial,
}: {
  matchId: string;
  initial: MatchState;
}) {
  const [state, setState] = useState<MatchState>(initial);
  const [advancing, setAdvancing] = useState(false);
  const router = useRouter();

  // The pit runs matches back-to-back autonomously — once this one settles,
  // keep checking for whichever match is now current and jump there, so the
  // Arena behaves like a continuously running channel instead of freezing on
  // a "MATCH OVER" screen once a newer match exists.
  useEffect(() => {
    if (state.status !== "SETTLED") return;
    let cancelled = false;
    const checkForNext = async () => {
      try {
        const r = await fetch("/api/current-match", { cache: "no-store" });
        if (!r.ok || cancelled) return;
        const { matchId: latest } = (await r.json()) as { matchId?: string };
        if (latest && latest !== matchId) {
          setAdvancing(true);
          router.push(`/match/${latest}`);
        }
      } catch {
        /* ignore */
      }
    };
    checkForNext();
    const interval = setInterval(checkForNext, 8000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [state.status, matchId, router]);

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

  // real per-round earnings, newest first — exactly how much each agent
  // gained or lost THAT round (vs the previous lock, or the starting stake
  // for round 0), not just a running total. Replaces vague commentary text.
  const roundEarnings = useMemo(() => {
    if (!left || !right) return [];
    const locked = state.rounds.filter((r) => r.lockedAt && r.balances[left.wallet] && r.balances[right.wallet]);
    return locked
      .map((r, i) => {
        const prevLeft = i > 0 ? BigInt(locked[i - 1]!.balances[left.wallet]!) : STAKE_USDC;
        const prevRight = i > 0 ? BigInt(locked[i - 1]!.balances[right.wallet]!) : STAKE_USDC;
        const leftBal = BigInt(r.balances[left.wallet]!);
        const rightBal = BigInt(r.balances[right.wallet]!);
        return {
          index: r.index,
          leftDelta: leftBal - prevLeft,
          rightDelta: rightBal - prevRight,
          ahead: leftBal === rightBal ? null : leftBal > rightBal ? ("left" as const) : ("right" as const),
          leftTx: r.txHashes?.[left.wallet] ?? [],
          rightTx: r.txHashes?.[right.wallet] ?? [],
        };
      })
      .reverse();
  }, [state, left, right]);

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto mt-4 flex max-w-3xl justify-center">
        <MatchStatusBadge status={state.status} />
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
      <BrutalCard className="mx-auto mt-8 max-w-3xl">
        <div className="p-6">
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
              let dotClass = "border-brutal-fg/30";
              if (done && left && right) {
                const lb = r.balances[left.wallet];
                const rb = r.balances[right.wallet];
                if (lb && rb) {
                  if (BigInt(lb) > BigInt(rb)) dotClass = "bg-emerald-500 border-emerald-500";
                  else if (BigInt(rb) > BigInt(lb)) dotClass = "bg-red-500 border-red-500";
                  else dotClass = "bg-brutal-fg/30 border-brutal-fg/30";
                }
              }
              return (
                <div
                  key={r.index}
                  className={`h-3 w-3 border-2 ${dotClass} ${isCurrent ? "animate-pulse border-brutal-accent" : ""}`}
                  title={`Round ${r.index + 1}`}
                />
              );
            })}
          </div>
        </div>
      </BrutalCard>

      {/* Audience zone */}
      <div className="mx-auto mt-8 max-w-3xl space-y-6">
        <BrutalCard>
          <div className="p-6">
            <p className="mb-3 text-center text-xs uppercase tracking-wider text-brutal-fg/50">
              round earnings — what each agent gained or lost that round
            </p>
            {roundEarnings.length === 0 ? (
              <p className="text-center text-xs uppercase tracking-wider text-brutal-fg/50">
                no rounds locked yet — match hasn&apos;t started
              </p>
            ) : (
              <div className="space-y-2">
                {roundEarnings.map((r) => {
                  return (
                    <div
                      key={r.index}
                      className="border-b border-brutal-fg/10 pb-2 font-brutal-mono text-xs last:border-0 last:pb-0"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-brutal-fg/50">
                          round {r.index + 1}
                          {r.ahead && (
                            <span className={r.ahead === "left" ? "text-emerald-500" : "text-red-500"}>
                              {" "}
                              — {r.ahead === "left" ? left!.handle : right!.handle} ahead
                            </span>
                          )}
                        </span>
                        <span className="flex gap-4">
                          <PnlValue baseUnits={r.leftDelta} />
                          <PnlValue baseUnits={r.rightDelta} />
                        </span>
                      </div>
                      {(r.leftTx.length > 0 || r.rightTx.length > 0) && (
                        <div className="mt-1 flex items-center justify-between text-[10px]">
                          <TxLinks hashes={r.leftTx} />
                          <TxLinks hashes={r.rightTx} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </BrutalCard>

        {(state.status === "REVEALED" || state.status === "SETTLED") && (
          <div className="space-y-3 text-center">
            <Link
              href={`/match/${matchId}/result`}
              className="inline-block border-2 border-brutal-fg px-4 py-2 font-brutal-mono text-xs uppercase tracking-widest text-brutal-fg hover:bg-brutal-fg hover:text-brutal-bg"
            >
              view full result &rarr;
            </Link>
            {state.status === "SETTLED" && (
              <p className="text-[10px] uppercase tracking-widest text-brutal-fg/40">
                {advancing ? "next match found — advancing…" : "watching for the next match…"}
              </p>
            )}
          </div>
        )}
      </div>
    </BrutalShell>
  );
}
