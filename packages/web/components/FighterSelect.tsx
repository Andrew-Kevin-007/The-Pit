"use client";

import { useEffect, useState } from "react";

export interface FighterOption {
  wallet: string;
  handle: string;
  side: "left" | "right";
}

/**
 * Pick-a-side button pair. Locks after one pick per session (localStorage),
 * no wallet needed — README: "for fun", not Sybil-resistant, moves no money.
 */
export function FighterSelect({ matchId, agents }: { matchId: string; agents: FighterOption[] }) {
  const [pick, setPick] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    try {
      setPick(localStorage.getItem(`pit_pick_${matchId}`));
    } catch {
      /* private-browsing etc. — picking just won't persist across reloads */
    }
  }, [matchId]);

  async function choose(wallet: string) {
    if (pick || pending) return;
    setPending(true);
    setPick(wallet);
    try {
      localStorage.setItem(`pit_pick_${matchId}`, wallet);
    } catch {
      /* ignore */
    }
    try {
      const clientId =
        (() => {
          try {
            return localStorage.getItem("pit_client") ?? "";
          } catch {
            return "";
          }
        })() || crypto.randomUUID();
      await fetch("/api/picks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ matchId, side: wallet, clientId }),
      });
    } catch {
      /* best-effort — the pick still shows locally either way */
    } finally {
      setPending(false);
    }
  }

  if (pick) {
    const handle = agents.find((a) => a.wallet.toLowerCase() === pick.toLowerCase())?.handle ?? pick.slice(0, 8);
    return <p className="font-mono text-sm text-pit-dim">You picked {handle} — good luck.</p>;
  }

  return (
    <div className="flex gap-3">
      {agents.map((a) => (
        <button
          key={a.wallet}
          onClick={() => choose(a.wallet)}
          disabled={pending}
          className={`flex-1 rounded-lg border px-4 py-3 font-mono text-sm uppercase tracking-wide transition-colors ${
            a.side === "left"
              ? "border-pit-green/40 text-pit-green hover:bg-pit-green/10"
              : "border-pit-red/40 text-pit-red hover:bg-pit-red/10"
          } disabled:opacity-50`}
        >
          {a.handle}
        </button>
      ))}
    </div>
  );
}
