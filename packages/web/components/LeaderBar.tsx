"use client";

import { useEffect, useState } from "react";
import type { LeadBucket } from "@the-pit/shared";

const SPLIT: Record<LeadBucket, [number, number]> = {
  EVEN: [50, 50],
  SLIGHT_EDGE: [55, 45],
  EDGE: [62, 38],
  STRONG_EDGE: [72, 28],
};

/**
 * The HP-bar equivalent. `ahead` says which side the split favors; `bucket`
 * is null while the 20s delay window hasn't cleared yet (README: "DELAYED —
 * last read Ns ago", never hidden, never guessed at).
 */
export function LeaderBar({
  bucket,
  ahead,
  asOf,
}: {
  bucket: LeadBucket | null;
  ahead: "left" | "right" | null;
  asOf: number | null;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  if (!bucket) {
    return (
      <div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-pit-border">
          <div className="h-full w-1/2 bg-pit-dim" />
        </div>
        <div className="mt-2 text-center text-xs uppercase tracking-wider text-pit-dim">
          delayed — no read yet
        </div>
      </div>
    );
  }

  const [left, right] = ahead === "right" ? [SPLIT[bucket][1], SPLIT[bucket][0]] : SPLIT[bucket];
  const even = bucket === "EVEN";
  const secondsAgo = asOf ? Math.max(0, Math.floor(Date.now() / 1000 - asOf)) : null;

  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full bg-pit-border animate-fade-in">
        <div
          className={`h-full transition-[width] duration-500 ${even ? "bg-pit-dim" : "bg-pit-green"}`}
          style={{ width: `${left}%` }}
        />
        <div
          className={`h-full transition-[width] duration-500 ${even ? "bg-pit-dim" : "bg-pit-red"}`}
          style={{ width: `${right}%` }}
        />
      </div>
      <div className="mt-2 text-center text-xs uppercase tracking-wider text-pit-dim">
        delayed — last read {secondsAgo ?? "?"}s ago
      </div>
    </div>
  );
}
