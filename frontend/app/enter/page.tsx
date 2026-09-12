import { STAKE_USDC, ROUND_COUNT, ROUND_SECONDS, MATCH_SECONDS } from "@the-pit/shared";
import { loadConfig } from "@the-pit/graph-client";
import { studioPlaygroundUrl } from "@/lib/subgraphLinks";
import { getCurrentMatchId } from "@/lib/currentMatch";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { BrutalButton } from "@/components/brutal/BrutalButton";
import { CtaButton } from "@/components/brutal/CtaButton";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import {
  BrutalAccordion,
  BrutalAccordionContent,
  BrutalAccordionItem,
  BrutalAccordionTrigger,
} from "@/components/brutal/BrutalAccordion";

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
  { title: "Registered wallets only", text: "the PitRouter rejects everyone else." },
  { title: "Trade cap per round", text: "enforced on-chain, not by trust." },
  { title: "Fee rebates", text: "swap fees rebated back into your stake at settlement." },
];

export default async function EnterPage() {
  const matchId = await getCurrentMatchId();
  const cfg = loadConfig();
  const studioUrl = studioPlaygroundUrl(cfg.matchUrl);

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mt-6 select-none font-pixel text-4xl tracking-tight">How to Enter</h1>
        <p className="mt-2 text-xs uppercase tracking-wider text-brutal-fg/50">
          fixed stake. six rounds. on-chain rules.
        </p>

        <ol className="mt-10 space-y-6">
          {STEPS.map((step, i) => (
            <li key={i} className="flex gap-4">
              <span className="font-brutal-mono text-[10px] tracking-[0.2em] text-brutal-fg/40">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="mt-1 text-sm text-brutal-fg">{step}</span>
            </li>
          ))}
        </ol>

        <h2 className="mb-4 mt-12 text-sm font-medium uppercase tracking-widest text-brutal-fg/50">
          enforced on-chain
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {RULES.map((r) => (
            <BrutalCard key={r.title}>
              <div className="p-4 text-center">
                <div className="text-sm font-medium text-brutal-fg">{r.title}</div>
                <p className="mt-2 text-xs text-brutal-fg/50">{r.text}</p>
              </div>
            </BrutalCard>
          ))}
        </div>

        <BrutalAccordion type="single" collapsible className="mt-12">
          <BrutalAccordionItem value="tech-details">
            <BrutalAccordionTrigger>Technical details</BrutalAccordionTrigger>
            <BrutalAccordionContent>
              <dl className="space-y-2 font-brutal-mono text-xs">
                <div className="flex justify-between gap-4">
                  <dt className="text-brutal-fg/50">MatchController</dt>
                  <dd className="truncate text-brutal-fg">{process.env.MATCH_CONTROLLER_ADDRESS ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-brutal-fg/50">PitRouter</dt>
                  <dd className="truncate text-brutal-fg">{process.env.PIT_ROUTER_ADDRESS ?? "—"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-brutal-fg/50">Pool</dt>
                  <dd className="truncate text-brutal-fg">{process.env.POOL_ADDRESS ?? "—"}</dd>
                </div>
              </dl>
            </BrutalAccordionContent>
          </BrutalAccordionItem>
        </BrutalAccordion>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <CtaButton href={`/match/${matchId}`} label="Watch the live match" />
          {studioUrl && (
            <BrutalButton href={studioUrl} target="_blank" rel="noreferrer">
              On-chain record
            </BrutalButton>
          )}
        </div>
      </div>
    </BrutalShell>
  );
}
