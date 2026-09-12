import Link from "next/link";
import { getAgentHistory, getMatchReveals } from "@the-pit/graph-client";
import { MOCK_MATCH } from "@the-pit/shared";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import { PnlValue } from "@/components/pit/PnlValue";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

function usd(baseUnits: string) {
  return (Number(BigInt(baseUnits)) / 1e6).toFixed(2);
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function AgentDossierPage({ params }: { params: Promise<{ address: string }> }) {
  const { address: rawAddress } = await params;
  const address = rawAddress.toLowerCase();
  const [matchId, history] = await Promise.all([
    getCurrentMatchId(),
    getAgentHistory(address, 50).catch(() => []),
  ]);

  const handle = MOCK_MATCH.agents.find((a) => a.wallet.toLowerCase() === address)?.handle ?? truncate(address);

  const wins = history.filter((h) => h.won).length;
  const losses = history.length - wins;
  const winRate = history.length ? Math.round((wins / history.length) * 100) : 0;
  const lifetimePnl = history.reduce((sum, h) => sum + BigInt(h.pnl), 0n);

  const settledMatches = history.filter((h) => h.match.status === "SETTLED");
  const revealRows = await Promise.all(
    settledMatches.map((h) =>
      getMatchReveals(h.match.id)
        .then((rows) => rows.find((r) => r.agent.id.toLowerCase() === address)?.config ?? null)
        .catch(() => null),
    ),
  );
  const revealByMatch = new Map(settledMatches.map((h, i) => [h.match.id, revealRows[i]]));

  const chronological = [...history].reverse();
  let running = 0n;
  const points = chronological.map((h) => {
    running += BigInt(h.pnl);
    return Number(running) / 1e6;
  });
  const max = Math.max(1, ...points.map((p) => Math.abs(p)));
  const svgPoints = points
    .map((p, i) => {
      const x = points.length > 1 ? (i / (points.length - 1)) * 100 : 0;
      const y = 20 - (p / max) * 18;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <BrutalCard className="mt-6">
          <div className="p-6">
            <div className="text-2xl font-medium text-brutal-fg">{handle}</div>
            <div className="mt-1 font-brutal-mono text-xs text-brutal-fg/50">{truncate(address)}</div>

            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div>
                <div className="text-xl text-brutal-fg">{history.length}</div>
                <div className="text-xs uppercase tracking-wider text-brutal-fg/50">matches</div>
              </div>
              <div>
                <div className="text-xl text-brutal-fg">
                  {wins}
                  {"–"}
                  {losses}
                </div>
                <div className="text-xs uppercase tracking-wider text-brutal-fg/50">record</div>
              </div>
              <div>
                <div className="text-xl text-brutal-fg">{winRate}%</div>
                <div className="text-xs uppercase tracking-wider text-brutal-fg/50">win rate</div>
              </div>
              <div>
                <div className="text-xl">
                  <PnlValue baseUnits={lifetimePnl} />
                </div>
                <div className="text-xs uppercase tracking-wider text-brutal-fg/50">lifetime pnl</div>
              </div>
            </div>

            {points.length > 1 && (
              <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="mt-6 h-12 w-full">
                <polyline
                  points={svgPoints}
                  fill="none"
                  stroke={running >= 0n ? "rgb(16 185 129)" : "rgb(239 68 68)"}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            )}
          </div>
        </BrutalCard>

        <h2 className="mb-3 mt-10 text-sm font-medium uppercase tracking-widest text-brutal-fg/50">match history</h2>
        {history.length === 0 ? (
          <p className="text-xs text-brutal-fg/50">no matches recorded yet for this wallet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const config = revealByMatch.get(h.match.id);
              return (
                <Link key={h.match.id} href={`/match/${h.match.id}/result`}>
                  <BrutalCard className={h.won ? "border-emerald-500/30" : "border-red-500/30"}>
                    <div className="p-4 text-xs">
                      <div className="flex items-center justify-between text-brutal-fg">
                        <span>match #{h.match.id}</span>
                        <span>{h.won ? "W" : "L"}</span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-brutal-fg/60">
                        <span>final ${usd(h.finalUsdc)}</span>
                        <PnlValue baseUnits={h.pnl} />
                      </div>
                      {config && <div className="mt-1 truncate text-brutal-fg/50">strategy: {config}</div>}
                    </div>
                  </BrutalCard>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </BrutalShell>
  );
}
