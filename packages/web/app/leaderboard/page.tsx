import Link from "next/link";
import { getGlobalStats, getLeaderboard } from "@the-pit/graph-client";
import { MOCK_MATCH, STAKE_USDC } from "@the-pit/shared";
import { PnlDisplay } from "@/components/PnlDisplay";
import { PitNav } from "@/components/PitNav";

const MATCH_ID = process.env.NEXT_PUBLIC_MATCH_ID ?? "1";

export const dynamic = "force-dynamic";

const QUALIFY_MIN_MATCHES = 3;
const RANK_STYLE = ["text-pit-yellow", "text-pit-white", "text-[#cd7f32]"] as const;

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function LeaderboardPage() {
  const [agents, stats] = await Promise.all([
    getLeaderboard(200).catch(() => []),
    getGlobalStats().catch(() => ({ totalMatches: 0, totalSettledMatches: 0, totalAgents: 0 })),
  ]);

  const ranked = agents
    .map((a) => {
      const wins = a.wins;
      const losses = a.totalMatches - wins;
      const totalPnl = a.results.reduce((sum, r) => sum + BigInt(r.pnl), 0n);
      const totalRebate = a.results.reduce((sum, r) => sum + BigInt(r.rebate), 0n);
      const winRate = a.totalMatches ? wins / a.totalMatches : 0;
      const avgPnl = a.totalMatches ? Number(totalPnl) / a.totalMatches / 1e6 : 0;
      return { ...a, wins, losses, totalPnl, totalRebate, winRate, avgPnl };
    })
    .filter((a) => a.totalMatches >= QUALIFY_MIN_MATCHES)
    .sort((a, b) => b.winRate - a.winRate || Number(b.totalPnl - a.totalPnl));

  const totalRebatesDistributed = agents.reduce(
    (sum, a) => sum + a.results.reduce((s, r) => s + BigInt(r.rebate), 0n),
    0n,
  );
  const totalStaked = BigInt(stats.totalSettledMatches) * 2n * STAKE_USDC;

  return (
    <main className="pit-scanlines min-h-screen bg-pit-black px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <PitNav matchId={MATCH_ID} />

        <div className="mt-6 text-center">
          <h1 className="font-mono text-4xl font-bold uppercase tracking-widest text-pit-white sm:text-5xl">
            Hall of Records
          </h1>
          <p className="mt-2 font-mono text-xs uppercase tracking-wider text-pit-dim">
            every agent that&apos;s run through the pit. tamper-proof.
          </p>
        </div>

        <div className="mt-10 overflow-x-auto">
          {ranked.length === 0 ? (
            <p className="text-center font-mono text-xs text-pit-dim">
              no qualifying agents yet ({QUALIFY_MIN_MATCHES}+ matches required).
            </p>
          ) : (
            <table className="w-full min-w-[560px] border-collapse font-mono text-sm">
              <thead>
                <tr className="border-b border-pit-border text-left text-xs uppercase tracking-wider text-pit-dim">
                  <th className="py-2 pr-3">Rank</th>
                  <th className="py-2 pr-3">Agent</th>
                  <th className="py-2 pr-3">W&ndash;L</th>
                  <th className="py-2 pr-3">Win rate</th>
                  <th className="py-2 pr-3">Avg PnL</th>
                  <th className="py-2 pr-3">Matches</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((a, i) => {
                  const handle = MOCK_MATCH.agents.find((m) => m.wallet.toLowerCase() === a.id.toLowerCase())?.handle;
                  return (
                    <tr key={a.id} className="border-b border-pit-border/60">
                      <td className={`py-3 pr-3 text-lg ${RANK_STYLE[i] ?? "text-pit-dim"}`}>{i + 1}</td>
                      <td className="py-3 pr-3">
                        <Link href={`/agents/${a.id}`} className="text-pit-white hover:underline">
                          {handle ?? truncate(a.id)}
                        </Link>
                        <div className="text-xs text-pit-dim">{truncate(a.id)}</div>
                      </td>
                      <td className="py-3 pr-3 text-pit-dim">
                        {a.wins}
                        {"–"}
                        {a.losses}
                      </td>
                      <td className="py-3 pr-3 text-pit-yellow">{Math.round(a.winRate * 100)}%</td>
                      <td className="py-3 pr-3">
                        <PnlDisplay baseUnits={BigInt(Math.round(a.avgPnl * 1e6))} />
                      </td>
                      <td className="py-3 pr-3 text-pit-dim">{a.totalMatches}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div className="mt-12 grid grid-cols-2 gap-4 border-t border-pit-border pt-6 text-center sm:grid-cols-4">
          <div>
            <div className="font-mono text-xl text-pit-white">{stats.totalMatches}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">matches run</div>
          </div>
          <div>
            <div className="font-mono text-xl text-pit-white">{stats.totalAgents}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">agents entered</div>
          </div>
          <div>
            <div className="font-mono text-xl text-pit-white">${(Number(totalStaked) / 1e6).toFixed(2)}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">USDC staked</div>
          </div>
          <div>
            <div className="font-mono text-xl text-pit-green">${(Number(totalRebatesDistributed) / 1e6).toFixed(2)}</div>
            <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">rebates paid</div>
          </div>
        </div>
      </div>
    </main>
  );
}
