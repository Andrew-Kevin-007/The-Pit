import Link from "next/link";
import { readBoard } from "@/lib/supabaseServer";
import { liveBoard } from "@/lib/liveBoard";
import { studioPlaygroundUrl } from "@/lib/subgraphLinks";
import { MOCK_MATCH, STAKE_USDC, type MatchState } from "@the-pit/shared";
import { getMatchReveals, loadConfig } from "@the-pit/graph-client";
import { PnlDisplay } from "@/components/PnlDisplay";
import { SubgraphLink } from "@/components/SubgraphLink";
import { PitNav } from "@/components/PitNav";

export const dynamic = "force-dynamic";

function usd(baseUnits: string) {
  return (Number(BigInt(baseUnits)) / 1e6).toFixed(2);
}

export default async function ResultPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;
  const state: MatchState =
    (await readBoard(matchId)) ?? (await liveBoard(matchId)) ?? MOCK_MATCH;

  const reveals = await getMatchReveals(matchId).catch(() => []);
  const revealByWallet = new Map(reveals.map((r) => [r.agent.id.toLowerCase(), r.config]));

  const left = state.agents[0] ?? null;
  const right = state.agents[1] ?? null;
  const stake = (Number(STAKE_USDC) / 1e6).toFixed(2);

  const resultOf = (wallet: string | undefined) =>
    wallet ? state.results.find((r) => r.wallet.toLowerCase() === wallet.toLowerCase()) ?? null : null;

  const leftResult = resultOf(left?.wallet);
  const rightResult = resultOf(right?.wallet);

  const tradesTotal = (wallet: string | undefined) =>
    wallet ? state.rounds.reduce((sum, r) => sum + (r.trades[wallet] ?? 0), 0) : 0;

  const roundsWon = (wallet: string | undefined, opponent: string | undefined) => {
    if (!wallet || !opponent) return 0;
    return state.rounds.filter((r) => {
      const a = r.balances[wallet];
      const b = r.balances[opponent];
      return a && b && BigInt(a) > BigInt(b);
    }).length;
  };

  const winnerHandle = state.winner
    ? state.agents.find((a) => a.wallet.toLowerCase() === state.winner!.toLowerCase())?.handle ?? "a fighter"
    : null;
  const winnerResult = resultOf(state.winner ?? undefined);
  const winnerSide = state.winner && left && state.winner.toLowerCase() === left.wallet.toLowerCase() ? "left" : "right";

  const cfg = loadConfig();
  const studioUrl = studioPlaygroundUrl(cfg.matchUrl);

  const revealed = state.status === "REVEALED" || state.status === "SETTLED";

  return (
    <main className="pit-scanlines min-h-screen bg-pit-black px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <PitNav matchId={matchId} />

        {/* Winner announcement */}
        <div className="animate-fade-in mt-10 text-center">
          {winnerHandle ? (
            <>
              <h1
                className={`font-mono text-4xl font-bold uppercase tracking-widest sm:text-6xl ${
                  winnerSide === "left" ? "text-pit-green" : "text-pit-red"
                }`}
              >
                {winnerHandle} WINS
              </h1>
              {winnerResult && (
                <p className="mt-3 font-mono text-lg">
                  by <PnlDisplay baseUnits={winnerResult.pnl} />
                </p>
              )}
            </>
          ) : (
            <h1 className="font-mono text-3xl uppercase tracking-widest text-pit-dim">match in progress</h1>
          )}
        </div>

        {/* Final scorecard */}
        {left && right && (
          <div className="mt-12 grid grid-cols-2 gap-4">
            {[
              { agent: left, result: leftResult, side: "left" as const },
              { agent: right, result: rightResult, side: "right" as const },
            ].map(({ agent, result, side }) => (
              <div
                key={agent.wallet}
                className={`rounded-xl border bg-pit-surface p-5 ${
                  side === "left" ? "border-pit-green/40" : "border-pit-red/40"
                }`}
              >
                <div className={`font-mono text-lg font-medium ${side === "left" ? "text-pit-green" : "text-pit-red"}`}>
                  {agent.handle}
                  {result?.won ? " ♦" : ""}
                </div>
                <dl className="mt-4 space-y-2 font-mono text-sm text-pit-dim">
                  <div className="flex justify-between">
                    <dt>final USDC</dt>
                    <dd className="text-pit-white">{result ? `$${usd(result.finalUsdc)}` : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>PnL</dt>
                    <dd>{result ? <PnlDisplay baseUnits={result.pnl} /> : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>rebate</dt>
                    <dd className="text-pit-white">{result ? `$${usd(result.rebate)}` : "—"}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>trades</dt>
                    <dd className="text-pit-white">{tradesTotal(agent.wallet)}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>rounds won</dt>
                    <dd className="text-pit-white">
                      {roundsWon(agent.wallet, side === "left" ? right.wallet : left.wallet)} / 6
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        )}

        <p className="mt-3 text-center font-mono text-xs uppercase tracking-wider text-pit-dim">
          stake was ${stake} per agent
        </p>

        {/* Strategy reveal */}
        {revealed && (left || right) && (
          <div className="mt-12">
            <h2 className="mb-4 font-mono text-sm uppercase tracking-widest text-pit-yellow">strategy exposed</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[left, right].map((agent) =>
                agent ? (
                  <div key={agent.wallet} className="rounded-xl border border-pit-border bg-pit-surface p-4">
                    <div className="font-mono text-sm text-pit-dim">{agent.handle}</div>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs text-pit-white">
                      {revealByWallet.get(agent.wallet.toLowerCase()) ?? "not revealed yet"}
                    </pre>
                  </div>
                ) : null,
              )}
            </div>
          </div>
        )}

        {/* Round by round breakdown */}
        {left && right && (
          <div className="mt-12">
            <h2 className="mb-4 font-mono text-sm uppercase tracking-widest text-pit-dim">round by round</h2>
            <div className="space-y-2">
              {state.rounds.map((r) => {
                const lb = r.balances[left.wallet];
                const rb = r.balances[right.wallet];
                const ahead = lb && rb ? (BigInt(lb) > BigInt(rb) ? "left" : BigInt(rb) > BigInt(lb) ? "right" : null) : null;
                return (
                  <div
                    key={r.index}
                    className="rounded-lg border border-pit-border bg-pit-surface px-4 py-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-pit-dim">
                      <span className="uppercase tracking-wider">round {r.index + 1}</span>
                      <span>
                        {lb ? `$${usd(lb)}` : "—"} vs {rb ? `$${usd(rb)}` : "—"}
                      </span>
                    </div>
                    {ahead && (
                      <div className={`mt-1 ${ahead === "left" ? "text-pit-green" : "text-pit-red"}`}>
                        {ahead === "left" ? left.handle : right.handle} ahead
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Subgraph proof */}
        <div className="mt-12 rounded-xl border border-pit-border bg-pit-surface p-5 text-center">
          <p className="font-mono text-xs uppercase tracking-wider text-pit-dim">match #{matchId} · permanent record</p>
          <div className="mt-3">
            {studioUrl ? (
              <SubgraphLink href={studioUrl} />
            ) : (
              <span className="font-mono text-xs text-pit-dim">subgraph not configured</span>
            )}
          </div>
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/"
            className="inline-block rounded-md border-2 border-pit-yellow px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-pit-yellow hover:bg-pit-yellow/10"
          >
            watch again &rarr;
          </Link>
        </div>
      </div>
    </main>
  );
}
