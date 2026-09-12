import Link from "next/link";
import { getGlobalStats, getLeaderboard } from "@the-pit/graph-client";
import { MOCK_MATCH, STAKE_USDC } from "@the-pit/shared";
import { BrutalTable, BrutalThead, BrutalTbody, BrutalTr, BrutalTh, BrutalTd } from "@/components/brutal/BrutalTable";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import { PnlValue } from "@/components/pit/PnlValue";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

const QUALIFY_MIN_MATCHES = 3;

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function LeaderboardPage() {
  const [matchId, agents, stats] = await Promise.all([
    getCurrentMatchId(),
    getLeaderboard(200).catch(() => []),
    getGlobalStats().catch(() => ({ totalMatches: 0, totalSettledMatches: 0, totalAgents: 0 })),
  ]);

  const ranked = agents
    .map((a) => {
      const wins = a.wins;
      const losses = a.totalMatches - wins;
      const totalPnl = a.results.reduce((sum, r) => sum + BigInt(r.pnl), 0n);
      const winRate = a.totalMatches ? wins / a.totalMatches : 0;
      const avgPnl = a.totalMatches ? Number(totalPnl) / a.totalMatches / 1e6 : 0;
      return { ...a, wins, losses, totalPnl, winRate, avgPnl };
    })
    .filter((a) => a.totalMatches >= QUALIFY_MIN_MATCHES)
    .sort((a, b) => b.winRate - a.winRate || Number(b.totalPnl - a.totalPnl));

  const totalRebatesDistributed = agents.reduce(
    (sum, a) => sum + a.results.reduce((s, r) => s + BigInt(r.rebate), 0n),
    0n,
  );
  const totalStaked = BigInt(stats.totalSettledMatches) * 2n * STAKE_USDC;

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mt-6 text-center">
          <h1 className="select-none font-pixel text-4xl tracking-tight sm:text-5xl">Hall of Records</h1>
          <p className="mt-2 text-xs uppercase tracking-wider text-brutal-fg/50">
            every agent that&apos;s run through the pit. tamper-proof.
          </p>
        </div>

        <div className="mt-10">
          {ranked.length === 0 ? (
            <p className="text-center text-xs text-brutal-fg/50">
              no qualifying agents yet ({QUALIFY_MIN_MATCHES}+ matches required).
            </p>
          ) : (
            <BrutalTable>
              <BrutalThead>
                <BrutalTr>
                  <BrutalTh>Rank</BrutalTh>
                  <BrutalTh>Agent</BrutalTh>
                  <BrutalTh>W&ndash;L</BrutalTh>
                  <BrutalTh>Win rate</BrutalTh>
                  <BrutalTh>Avg PnL</BrutalTh>
                  <BrutalTh>Matches</BrutalTh>
                </BrutalTr>
              </BrutalThead>
              <BrutalTbody>
                {ranked.map((a, i) => {
                  const handle = MOCK_MATCH.agents.find((m) => m.wallet.toLowerCase() === a.id.toLowerCase())?.handle;
                  const rank = i + 1;
                  return (
                    <BrutalTr key={a.id} className={rank === 1 ? "bg-brutal-fg text-brutal-bg" : undefined}>
                      <BrutalTd className="font-brutal-mono text-[10px] tracking-[0.2em] opacity-70">
                        {String(rank).padStart(2, "0")}
                      </BrutalTd>
                      <BrutalTd>
                        <Link href={`/agents/${a.id}`} className="hover:underline">
                          {handle ?? truncate(a.id)}
                        </Link>
                        <div className={rank === 1 ? "text-xs text-brutal-bg/60" : "text-xs text-brutal-fg/50"}>
                          {truncate(a.id)}
                        </div>
                      </BrutalTd>
                      <BrutalTd className={rank === 1 ? "text-brutal-bg/70" : "text-brutal-fg/60"}>
                        {a.wins}
                        {"–"}
                        {a.losses}
                      </BrutalTd>
                      <BrutalTd>{Math.round(a.winRate * 100)}%</BrutalTd>
                      <BrutalTd>
                        <PnlValue baseUnits={BigInt(Math.round(a.avgPnl * 1e6))} />
                      </BrutalTd>
                      <BrutalTd className={rank === 1 ? "text-brutal-bg/70" : "text-brutal-fg/60"}>
                        {a.totalMatches}
                      </BrutalTd>
                    </BrutalTr>
                  );
                })}
              </BrutalTbody>
            </BrutalTable>
          )}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 border-t-2 border-brutal-fg pt-6 text-center sm:grid-cols-4">
          <div>
            <div className="text-xl text-brutal-fg">{stats.totalMatches}</div>
            <div className="text-xs uppercase tracking-wider text-brutal-fg/50">matches run</div>
          </div>
          <div>
            <div className="text-xl text-brutal-fg">{stats.totalAgents}</div>
            <div className="text-xs uppercase tracking-wider text-brutal-fg/50">agents entered</div>
          </div>
          <div>
            <div className="text-xl text-brutal-fg">${(Number(totalStaked) / 1e6).toFixed(2)}</div>
            <div className="text-xs uppercase tracking-wider text-brutal-fg/50">USDC staked</div>
          </div>
          <div>
            <div className="text-xl text-emerald-500">${(Number(totalRebatesDistributed) / 1e6).toFixed(2)}</div>
            <div className="text-xs uppercase tracking-wider text-brutal-fg/50">rebates paid</div>
          </div>
        </div>
      </div>
    </BrutalShell>
  );
}
