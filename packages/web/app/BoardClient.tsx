"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  coarseLeader,
  LEAD_LABEL,
  secondsLeft,
  STAKE_USDC,
  type MatchState,
} from "@the-pit/shared";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

function fmtClock(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function usd(baseUnits: string) {
  return (Number(BigInt(baseUnits)) / 1e6).toFixed(2);
}

export default function BoardClient({
  matchId,
  initial,
}: {
  matchId: string;
  initial: MatchState;
}) {
  const [state, setState] = useState<MatchState>(initial);
  const [pick, setPick] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const clientId = useRef<string>("");

  useEffect(() => {
    clientId.current =
      localStorage.getItem("pit_client") ??
      (() => {
        const id = crypto.randomUUID();
        localStorage.setItem("pit_client", id);
        return id;
      })();
    setPick(localStorage.getItem(`pit_pick_${matchId}`));
  }, [matchId]);

  // 1s clock
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // realtime + poll fallback
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

  const clock = useMemo(() => {
    if (!state.startTime || state.status === "SETTLED")
      return { label: state.status, round: null as number | null, roundRemaining: 0, matchRemaining: 0 };
    const { round, roundRemaining, matchRemaining } = secondsLeft(state.startTime);
    return { label: round === null ? "LOCKED" : `ROUND ${round + 1} / 6`, round, roundRemaining, matchRemaining };
  }, [state, tick]);

  const lastLocked = useMemo(() => {
    const locked = [...state.rounds].reverse().find((r) => r.lockedAt && Object.keys(r.balances).length >= 2);
    if (!locked) return null;
    return coarseLeader(locked.balances, locked.lockedAt!, Date.now() / 1000);
  }, [state, tick]);

  const revealed = state.status === "REVEALED" || state.status === "SETTLED";

  async function submitPick(side: string) {
    if (pick) return;
    setPick(side);
    localStorage.setItem(`pit_pick_${matchId}`, side);
    await fetch("/api/picks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ matchId, side, clientId: clientId.current }),
    }).catch(() => {});
  }

  const handleOf = (w: string) =>
    state.agents.find((a) => a.wallet.toLowerCase() === w.toLowerCase())?.handle ?? w.slice(0, 8);

  return (
    <>
      <div className="panel">
        <div className="clock">
          {state.status === "SETTLED" ? "FINAL" : fmtClock(clock.roundRemaining)}{" "}
          <small>{clock.label}</small>
        </div>
        <div className="lead-row">
          {lastLocked ? (
            lastLocked.ahead ? (
              <>
                <span className="badge">{LEAD_LABEL[lastLocked.bucket]}</span>
                <span className="dim">{handleOf(lastLocked.ahead)} ahead · delayed, coarse</span>
              </>
            ) : (
              <span className="dim">Neck and neck · delayed, coarse</span>
            )
          ) : (
            <span className="dim">Lead hidden until the first round locks (+20s delay)</span>
          )}
        </div>
      </div>

      <div className="panel">
        {state.rounds
          .filter((r) => Object.keys(r.commentary).length > 0)
          .map((r) => (
            <div className="round" key={r.index}>
              <h3>
                Round {r.index + 1}
                {r.lockedAt ? " · locked" : " · live"}
              </h3>
              {Object.entries(r.commentary).map(([w, say]) => (
                <div className="line" key={w}>
                  <span className="who">{handleOf(w)}</span>
                  <span className="say">{say}</span>
                </div>
              ))}
            </div>
          ))}
        {state.rounds.every((r) => Object.keys(r.commentary).length === 0) && (
          <span className="dim">No commentary yet — match hasn&apos;t started.</span>
        )}
      </div>

      <div className="panel">
        <h3 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>
          Pick a side — for fun, no wallet, moves no money
        </h3>
        <div className="picks">
          {state.agents.map((a) => (
            <button
              key={a.wallet}
              aria-pressed={pick === a.wallet}
              disabled={!!pick || state.status === "SETTLED"}
              onClick={() => submitPick(a.wallet)}
            >
              {a.handle}
            </button>
          ))}
        </div>
        {pick && <p className="dim" style={{ marginTop: 8 }}>You picked {handleOf(pick)}.</p>}
      </div>

      {revealed && state.results.length > 0 && (
        <div className="panel">
          <h3 style={{ margin: "0 0 4px", fontSize: 13, color: "var(--muted)" }}>
            Result — exact now that it&apos;s revealed
          </h3>
          {state.results
            .slice()
            .sort((a, b) => Number(BigInt(b.finalUsdc) - BigInt(a.finalUsdc)))
            .map((r) => {
              const up = BigInt(r.pnl) >= 0n;
              return (
                <div className="result" key={r.wallet}>
                  <span>
                    {handleOf(r.wallet)} {r.won ? "🏆" : ""}
                  </span>
                  <span className={up ? "pnl-up" : "pnl-down"}>
                    ${usd(r.finalUsdc)}{" "}
                    ({up ? "+" : ""}
                    {(Number(BigInt(r.pnl)) / 1e6).toFixed(2)}) · rebate ${usd(r.rebate)}
                  </span>
                </div>
              );
            })}
          <p className="dim" style={{ marginTop: 8 }}>
            Stake was ${usd(STAKE_USDC.toString())}. Full record in the subgraph.
          </p>
        </div>
      )}
    </>
  );
}
