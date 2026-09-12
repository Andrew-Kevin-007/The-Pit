"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabaseBrowser";

/** "N picks cast this match" — realtime, Supabase-backed. Purely for
 *  atmosphere; the real pick record is the on-chain submitPick() event. */
export function SpectatorCount({ matchId }: { matchId: string }) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;

    let cancelled = false;
    sb.from("picks")
      .select("id", { count: "exact", head: true })
      .eq("match_id", matchId)
      .then(({ count: c }) => {
        if (!cancelled) setCount(c ?? 0);
      });

    const channel = sb
      .channel(`picks:${matchId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "picks", filter: `match_id=eq.${matchId}` },
        () => setCount((prev) => (prev ?? 0) + 1),
      )
      .subscribe();

    return () => {
      cancelled = true;
      sb.removeChannel(channel);
    };
  }, [matchId]);

  if (count === null || count === 0) return null;
  return (
    <p className="text-center text-[10px] uppercase tracking-widest text-brutal-fg/40">
      {count} pick{count === 1 ? "" : "s"} cast this match
    </p>
  );
}
