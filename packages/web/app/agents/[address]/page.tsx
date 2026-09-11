import Link from "next/link";
import { getAgentHistory, getMatchReveals } from "@the-pit/graph-client";
import { MOCK_MATCH } from "@the-pit/shared";
import { PnlDisplay } from "@/components/PnlDisplay";
import { PitNav } from "@/components/PitNav";

const MATCH_ID = process.env.NEXT_PUBLIC_MATCH_ID ?? "1";

export const dynamic = "force-dynamic";

function usd(baseUnits: string) {
  return (Number(BigInt(baseUnits)) / 1e6).toFixed(2);
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default async function AgentDossierPage({ params }: { params: { address: string } }) {
  const address = params.address.toLowerCase();
  const history = await getAgentHistory(address, 50).catch(() => []);

  // Best-effort display handle: real handles aren't stored on-chain / in the
  // subgraph (only wallets are), so fall back to the bundled roster, then a
  // truncated address.
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

  // Cumulative PnL sparkline (oldest -> newest; history comes back newest-first).
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
    <main className="pit-scanlines min-h-screen bg-pit-black px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <PitNav matchId={MATCH_ID} />
        <Link
          href="/leaderboard"
          className="mt-4 inline-block font-mono text-xs uppercase tracking-widest text-pit-dim hover:text-pit-white"
        >
          &larr; hall of records
        </Link>

        <div className="mt-6 rounded-xl border border-pit-border bg-pit-surface p-6">
          <div className="font-mono text-2xl text-pit-white">{handle}</div>
          <div className="mt-1 font-mono text-xs text-pit-dim">{truncate(address)}</div>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="font-mono text-xl text-pit-white">{history.length}</div>
              <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">matches</div>
            </div>
            <div>
              <div className="font-mono text-xl text-pit-white">
                {wins}
                {"–"}
                {losses}
              </div>
              <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">record</div>
            </div>
            <div>
              <div className="font-mono text-xl text-pit-yellow">{winRate}%</div>
              <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">win rate</div>
            </div>
            <div>
              <div className="font-mono text-xl">
                <PnlDisplay baseUnits={lifetimePnl} />
              </div>
              <div className="font-mono text-xs uppercase tracking-wider text-pit-dim">lifetime pnl</div>
            </div>
          </div>

          {points.length > 1 && (
            <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="mt-6 h-12 w-full">
              <polyline
                points={svgPoints}
                fill="none"
                stroke={running >= 0n ? "#00ff87" : "#ff3c5f"}
                strokeWidth="1"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>

        <h2 className="mb-3 mt-10 font-mono text-sm uppercase tracking-widest text-pit-dim">match history</h2>
        {history.length === 0 ? (
          <p className="font-mono text-xs text-pit-dim">no matches recorded yet for this wallet.</p>
        ) : (
          <div className="space-y-2">
            {history.map((h) => {
              const config = revealByMatch.get(h.match.id);
              return (
                <Link
                  key={h.match.id}
                  href={`/match/${h.match.id}/result`}
                  className={`block rounded-lg border px-4 py-3 font-mono text-xs transition-colors hover:border-pit-white/40 ${
                    h.won ? "border-pit-green/30 bg-pit-green/5" : "border-pit-red/30 bg-pit-red/5"
                  }`}
                >
                  <div className="flex items-center justify-between text-pit-white">
                    <span>match #{h.match.id}</span>
                    <span>{h.won ? "W" : "L"}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-pit-dim">
                    <span>final ${usd(h.finalUsdc)}</span>
                    <PnlDisplay baseUnits={h.pnl} />
                  </div>
                  {config && <div className="mt-1 truncate text-pit-dim">strategy: {config}</div>}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
