"use client";

import { useEffect, useState } from "react";

/** Reads this viewer's own on-chain pick for a match back out of localStorage. */
export function PickBadge({ matchId, handles }: { matchId: string; handles: Record<string, string> }) {
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPick(localStorage.getItem(`pit_pick_${matchId}`));
    } catch {
      /* private browsing etc. */
    }
  }, [matchId]);

  if (!pick) return <span className="text-brutal-fg/30">—</span>;
  const handle = handles[pick.toLowerCase()] ?? `${pick.slice(0, 6)}…${pick.slice(-4)}`;
  return <span className="text-brutal-accent">{handle}</span>;
}
