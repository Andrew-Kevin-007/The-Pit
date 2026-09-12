"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabaseBrowser";
import { BrutalTable, BrutalThead, BrutalTbody, BrutalTr, BrutalTh, BrutalTd } from "@/components/brutal/BrutalTable";
import { PnlValue } from "@/components/pit/PnlValue";
import type { BenchmarkRow } from "@/lib/benchmark";

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Realtime benchmark feed — subscribes to agent_benchmarks so every viewer
 * sees a new row the instant a match settles, no reload needed. The subgraph
 * stays the tamper-proof record; this is the fast view in front of it.
 */
export function BenchmarkFeed({ initial }: { initial: BenchmarkRow[] }) {
  const [rows, setRows] = useState<BenchmarkRow[]>(initial);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const sb = supabaseBrowser();
    if (!sb) return;
    const channel = sb
      .channel("agent_benchmarks_feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_benchmarks" }, (payload) => {
        const row = payload.new as BenchmarkRow;
        if (!row) return;
        setRows((prev) => {
          const withoutDup = prev.filter((r) => !(r.match_id === row.match_id && r.agent === row.agent));
          return [row, ...withoutDup].sort((a, b) => (a.settled_at < b.settled_at ? 1 : -1));
        });
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  if (rows.length === 0) {
    return (
      <p className="text-center text-xs text-brutal-fg/50">
        no benchmark data yet — settle a real match to populate this.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-3 text-center text-[10px] uppercase tracking-widest text-brutal-fg/40">
        {live ? "live — updates the instant a match settles" : "connecting…"}
      </p>
      <BrutalTable>
        <BrutalThead>
          <BrutalTr>
            <BrutalTh>Match</BrutalTh>
            <BrutalTh>Agent</BrutalTh>
            <BrutalTh>Strategy</BrutalTh>
            <BrutalTh>Final</BrutalTh>
            <BrutalTh>PnL</BrutalTh>
            <BrutalTh>Trades</BrutalTh>
            <BrutalTh>Result</BrutalTh>
          </BrutalTr>
        </BrutalThead>
        <BrutalTbody>
          {rows.map((r) => (
            <BrutalTr key={`${r.match_id}-${r.agent}`}>
              <BrutalTd>
                <Link href={`/match/${r.match_id}/result`} className="hover:underline">
                  #{r.match_id}
                </Link>
              </BrutalTd>
              <BrutalTd>
                {r.handle ?? truncate(r.agent)}
                <div className="text-[10px] text-brutal-fg/40">{truncate(r.agent)}</div>
              </BrutalTd>
              <BrutalTd className="text-brutal-fg/60">{r.strategy ?? "—"}</BrutalTd>
              <BrutalTd>${(Number(BigInt(r.final_usdc)) / 1e6).toFixed(2)}</BrutalTd>
              <BrutalTd>
                <PnlValue baseUnits={r.pnl} />
              </BrutalTd>
              <BrutalTd className="text-brutal-fg/60">{r.trades_total}</BrutalTd>
              <BrutalTd>
                {r.won ? <span className="text-emerald-600">WIN</span> : <span className="text-brutal-fg/40">loss</span>}
              </BrutalTd>
            </BrutalTr>
          ))}
        </BrutalTbody>
      </BrutalTable>
    </div>
  );
}
