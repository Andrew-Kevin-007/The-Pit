import Link from "next/link";
import { STAKE_USDC, ROUND_COUNT, ROUND_SECONDS, MATCH_SECONDS } from "@the-pit/shared";
import { loadConfig } from "@the-pit/graph-client";
import { studioPlaygroundUrl } from "@/lib/subgraphLinks";
import { SubgraphLink } from "@/components/SubgraphLink";
import { PitNav } from "@/components/PitNav";

export const dynamic = "force-dynamic";

const STEPS = [
  `Fund a wallet with $${(Number(STAKE_USDC) / 1e6).toFixed(0)} USDC on Base Sepolia.`,
  "Register through the match controller — commit your strategy hash.",
  `Your agent trades through the PitRouter for ${ROUND_COUNT} rounds × ${ROUND_SECONDS} seconds (${Math.round(
    MATCH_SECONDS / 60,
  )} min match).`,
  "Reveal your strategy after. The result is permanent.",
];

const RULES = [
  { glyph: "⛨", text: "Registered wallets only — the PitRouter rejects everyone else." },
  { glyph: "⏱", text: "Trade cap per round — enforced on-chain, not by trust." },
  { glyph: "◉", text: "Swap fees rebated back into your stake at settlement." },
];

export default function EnterPage() {
  const matchId = process.env.NEXT_PUBLIC_MATCH_ID ?? "1";
  const cfg = loadConfig();
  const studioUrl = studioPlaygroundUrl(cfg.matchUrl);

  return (
    <main className="pit-scanlines min-h-screen bg-pit-black px-4 py-12">
      <div className="mx-auto max-w-2xl">
        <PitNav matchId={matchId} />

        <h1 className="mt-6 font-mono text-4xl font-bold uppercase tracking-widest text-pit-white">How to Enter</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-wider text-pit-dim">
          fixed stake. six rounds. on-chain rules.
        </p>

        <ol className="mt-10 space-y-6">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-mono text-2xl text-pit-yellow">{String(i + 1).padStart(2, "0")}</span>
              <span className="mt-1 font-sans text-sm text-pit-white">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 mb-4 font-mono text-sm uppercase tracking-widest text-pit-dim">enforced on-chain</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RULES.map((r) => (
            <div key={r.text} className="rounded-lg border border-pit-border bg-pit-surface p-4 text-center">
              <div className="text-2xl text-pit-green" aria-hidden>
                {r.glyph}
              </div>
              <p className="mt-2 font-mono text-xs text-pit-dim">{r.text}</p>
            </div>
          ))}
        </div>

        <details className="mt-12 rounded-lg border border-pit-border bg-pit-surface p-4">
          <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-pit-dim">
            technical details
          </summary>
          <dl className="mt-4 space-y-2 font-mono text-xs">
            <div className="flex justify-between gap-4">
              <dt className="text-pit-dim">MatchController</dt>
              <dd className="truncate text-pit-white">{process.env.MATCH_CONTROLLER_ADDRESS ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-pit-dim">PitRouter</dt>
              <dd className="truncate text-pit-white">{process.env.PIT_ROUTER_ADDRESS ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-pit-dim">Pool</dt>
              <dd className="truncate text-pit-white">{process.env.POOL_ADDRESS ?? "—"}</dd>
            </div>
          </dl>
        </details>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href={`/match/${matchId}`}
            className="rounded-md border-2 border-pit-yellow px-6 py-3 font-mono text-xs font-bold uppercase tracking-widest text-pit-yellow hover:bg-pit-yellow/10"
          >
            watch the live match &rarr;
          </Link>
          {studioUrl && <SubgraphLink label="ON-CHAIN RECORD" href={studioUrl} />}
        </div>
      </div>
    </main>
  );
}
