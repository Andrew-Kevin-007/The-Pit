"use client";

import { useEffect, useState } from "react";
import { ROUND_COUNT, secondsLeft, type MatchStatus } from "@the-pit/shared";
import { cn } from "@/lib/utils";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/** Countdown derived purely from `secondsLeft()` — never calls the server per tick. */
export function RoundClock({ startTime, status }: { startTime: number | null; status: MatchStatus }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (status === "SETTLED") {
    return (
      <div className="text-center">
        <div className="font-brutal-mono text-4xl tracking-widest text-brutal-fg">MATCH OVER</div>
      </div>
    );
  }

  if (!startTime) {
    return (
      <div className="text-center">
        <div className="font-brutal-mono text-4xl tracking-widest text-brutal-fg/50">--:--</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-brutal-fg/50">awaiting start</div>
      </div>
    );
  }

  const { round, roundRemaining } = secondsLeft(startTime);
  const urgent = round !== null && roundRemaining < 10;

  return (
    <div className="text-center">
      <div
        className={cn(
          "font-brutal-mono text-4xl tabular-nums tracking-widest",
          round === null ? "text-brutal-fg/50" : urgent ? "animate-pulse text-brutal-accent" : "text-brutal-fg",
        )}
      >
        {round === null ? "LOCKED" : fmt(roundRemaining)}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-brutal-fg/50">
        {round === null ? "round locked" : `round ${round + 1} / ${ROUND_COUNT}`}
      </div>
    </div>
  );
}
