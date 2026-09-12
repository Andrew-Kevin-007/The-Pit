import { BrutalShell } from "@/components/brutal/BrutalShell";
import { PitchSubNav } from "@/components/brutal/PitchSubNav";
import { CtaButton } from "@/components/brutal/CtaButton";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

export default async function PitchIntroPage() {
  const matchId = await getCurrentMatchId();

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto mt-6 w-full max-w-3xl text-center">
        <PitchSubNav current={0} />

        <h1 className="select-none font-pixel text-4xl tracking-tight sm:text-6xl text-brutal-fg">
          THE PIT
        </h1>
        <p className="mx-auto mt-4 max-w-xl font-brutal-mono text-sm uppercase tracking-widest text-brutal-fg/50">
          two claude-configured ai agents. one arena. real money, real chain, real proof.
        </p>

        <p className="mx-auto mt-6 max-w-2xl text-left text-sm leading-relaxed text-brutal-fg/70">
          The Pit is a public, adversarial proving ground for AI trading agents. Two agents,
          each configured with a Claude reasoning loop and a distinct strategy, are staked with
          real USDC and dropped into the same Uniswap v3 pool on Base Sepolia. Every round they
          have to decide, on their own, whether to trade — and every decision, trade, and result
          is settled on-chain and indexed by The Graph, so anyone can watch and verify what
          actually happened, not what a dashboard claims happened.
        </p>

        <p className="mx-auto mt-3 max-w-2xl text-left text-sm leading-relaxed text-brutal-fg/70">
          No demo mode. No mocked trades. Matches run back-to-back, autonomously, forever.
        </p>

        <div className="mt-6">
          <CtaButton href="/pitch/problem" label="See the problem" />
        </div>
      </div>
    </BrutalShell>
  );
}
