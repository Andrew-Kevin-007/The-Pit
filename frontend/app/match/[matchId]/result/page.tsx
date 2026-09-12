import { readBoard } from "@/lib/supabaseServer";
import { liveBoard } from "@/lib/liveBoard";
import { studioPlaygroundUrl } from "@/lib/subgraphLinks";
import { MOCK_MATCH, STAKE_USDC, type MatchState } from "@the-pit/shared";
import { getMatchReveals, loadConfig } from "@the-pit/graph-client";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { CtaButton } from "@/components/brutal/CtaButton";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import { PnlValue } from "@/components/pit/PnlValue";
import { TxLinks } from "@/components/pit/TxLinks";

export const dynamic = "force-dynamic";

function usd(baseUnits: string) {
  return (Number(BigInt(baseUnits)) / 1e6).toFixed(2);
}

export default async function ResultPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params;
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
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        {/* Winner announcement */}
        <div className="mt-10 text-center">
          {winnerHandle ? (
            <>
              <h1
                className={`select-none font-pixel text-4xl tracking-tight sm:text-6xl ${
                  winnerSide === "left" ? "text-emerald-500" : "text-red-500"
                }`}
              >
                {winnerHandle} WINS
              </h1>
              {winnerResult && (
                <p className="mt-3 text-lg">
                  by <PnlValue baseUnits={winnerResult.pnl} />
                </p>
              )}
            </>
          ) : (
            <h1 className="text-3xl text-brutal-fg/50">match in progress</h1>
          )}
        </div>

        {/* Final scorecard */}
        {left && right && (
          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { agent: left, result: leftResult, side: "left" as const },
              { agent: right, result: rightResult, side: "right" as const },
            ].map(({ agent, result, side }) => (
              <BrutalCard
                key={agent.wallet}
                className={side === "left" ? "border-emerald-500/40" : "border-red-500/40"}
              >
                <div className="p-5">
                  <div
                    className={`font-brutal-mono text-lg font-medium ${side === "left" ? "text-emerald-500" : "text-red-500"}`}
                  >
                    {agent.handle}
                    {result?.won ? " ♦" : ""}
                  </div>
                  <dl className="mt-4 space-y-2 text-sm text-brutal-fg/60">
                    <div className="flex justify-between">
                      <dt>final USDC</dt>
                      <dd className="text-brutal-fg">{result ? `$${usd(result.finalUsdc)}` : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>PnL</dt>
                      <dd>{result ? <PnlValue baseUnits={result.pnl} /> : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>rebate</dt>
                      <dd className="text-brutal-fg">{result ? `$${usd(result.rebate)}` : "—"}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>trades</dt>
                      <dd className="text-brutal-fg">{tradesTotal(agent.wallet)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>rounds won</dt>
                      <dd className="text-brutal-fg">
                        {roundsWon(agent.wallet, side === "left" ? right.wallet : left.wallet)} / 6
                      </dd>
                    </div>
                  </dl>
                </div>
              </BrutalCard>
            ))}
          </div>
        )}

        <p className="mt-3 text-center text-xs uppercase tracking-wider text-brutal-fg/50">
          stake was ${stake} per agent
        </p>

        {/* Strategy reveal */}
        {revealed && (left || right) && (
          <div className="mt-12">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-brutal-fg/50">strategy exposed</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {[left, right].map((agent) =>
                agent ? (
                  <BrutalCard key={agent.wallet}>
                    <div className="p-4">
                      <div className="text-sm text-brutal-fg/50">{agent.handle}</div>
                      <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words font-brutal-mono text-xs text-brutal-fg">
                        {revealByWallet.get(agent.wallet.toLowerCase()) ?? "not revealed yet"}
                      </pre>
                    </div>
                  </BrutalCard>
                ) : null,
              )}
            </div>
          </div>
        )}

        {/* Round by round breakdown — what each agent earned or lost that
            specific round (vs the previous lock, or the starting stake for
            round 0), not just the running balance. */}
        {left && right && (
          <div className="mt-12">
            <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-brutal-fg/50">round by round</h2>
            <div className="space-y-2">
              {state.rounds
                .filter((r) => r.lockedAt && r.balances[left.wallet] && r.balances[right.wallet])
                .map((r, i, locked) => {
                  const prevLeft = i > 0 ? BigInt(locked[i - 1]!.balances[left.wallet]!) : STAKE_USDC;
                  const prevRight = i > 0 ? BigInt(locked[i - 1]!.balances[right.wallet]!) : STAKE_USDC;
                  const leftBal = BigInt(r.balances[left.wallet]!);
                  const rightBal = BigInt(r.balances[right.wallet]!);
                  const leftDelta = leftBal - prevLeft;
                  const rightDelta = rightBal - prevRight;
                  const ahead = leftBal === rightBal ? null : leftBal > rightBal ? "left" : "right";
                  const leftTx = r.txHashes?.[left.wallet] ?? [];
                  const rightTx = r.txHashes?.[right.wallet] ?? [];
                  return (
                    <BrutalCard key={r.index}>
                      <div className="p-4 text-xs">
                        <div className="flex items-center justify-between text-brutal-fg/60">
                          <span className="uppercase tracking-wider">
                            round {r.index + 1}
                            {ahead && (
                              <span className={ahead === "left" ? "text-emerald-500" : "text-red-500"}>
                                {" "}
                                — {ahead === "left" ? left.handle : right.handle} ahead
                              </span>
                            )}
                          </span>
                          <span className="flex gap-4">
                            <PnlValue baseUnits={leftDelta} />
                            <PnlValue baseUnits={rightDelta} />
                          </span>
                        </div>
                        <div className="mt-1 flex justify-between text-brutal-fg/40">
                          <span>balance ${usd(r.balances[left.wallet]!)}</span>
                          <span>balance ${usd(r.balances[right.wallet]!)}</span>
                        </div>
                        {(leftTx.length > 0 || rightTx.length > 0) && (
                          <div className="mt-1 flex items-center justify-between text-[10px]">
                            <TxLinks hashes={leftTx} />
                            <TxLinks hashes={rightTx} />
                          </div>
                        )}
                      </div>
                    </BrutalCard>
                  );
                })}
            </div>
          </div>
        )}

        {/* Subgraph proof */}
        <BrutalCard className="mt-12">
          <div className="p-5 text-center">
            <p className="text-xs uppercase tracking-wider text-brutal-fg/50">match #{matchId} · permanent record</p>
            <div className="mt-3">
              {studioUrl ? (
                <BrutalButton href={studioUrl} target="_blank" rel="noreferrer">
                  On-chain record — tamper-proof
                </BrutalButton>
              ) : (
                <span className="text-xs text-brutal-fg/50">subgraph not configured</span>
              )}
            </div>
          </div>
        </BrutalCard>

        <div className="mt-10 text-center">
          <CtaButton href="/" label="Watch again" />
        </div>
      </div>
    </BrutalShell>
  );
}
