"use client";

import { useEffect, useState } from "react";
import { ROUND_COUNT, secondsLeft, type MatchStatus } from "@the-pit/shared";

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

/**
 * Countdown derived purely from `secondsLeft()` — never calls the server per
 * tick. Pulses pit-yellow below 10s per the design system's Motion rules.
 */
export function RoundClock({ startTime, status }: { startTime: number | null; status: MatchStatus }) {
  const [, tick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (status === "SETTLED") {
    return (
      <div className="text-center font-mono">
        <div className="text-4xl tracking-widest text-pit-white">MATCH OVER</div>
      </div>
    );
  }

  if (!startTime) {
    return (
      <div className="text-center font-mono">
        <div className="text-4xl tracking-widest text-pit-dim">--:--</div>
        <div className="mt-1 text-xs uppercase tracking-wider text-pit-dim">awaiting start</div>
      </div>
    );
  }

  const { round, roundRemaining } = secondsLeft(startTime);
  const urgent = round !== null && roundRemaining < 10;

  return (
    <div className="text-center font-mono">
      <div
        className={`text-4xl tabular-nums tracking-widest ${
          round === null ? "text-pit-dim" : urgent ? "text-pit-yellow animate-pulse-yellow" : "text-pit-white"
        }`}
      >
        {round === null ? "LOCKED" : fmt(roundRemaining)}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wider text-pit-dim">
        {round === null ? "round locked" : `round ${round + 1} / ${ROUND_COUNT}`}
      </div>
    </div>
  );
}
