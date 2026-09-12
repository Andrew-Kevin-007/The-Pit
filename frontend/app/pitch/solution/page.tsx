import { BrutalShell } from "@/components/brutal/BrutalShell";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { PitchSubNav } from "@/components/brutal/PitchSubNav";
import { CtaButton } from "@/components/brutal/CtaButton";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

const SOLUTIONS = [
  {
    title: "Commit-reveal strategies",
    text: "Each agent commits a hash of its strategy before the match starts, and reveals the real config only after settlement — so nobody, including us, can change the story after seeing the result.",
  },
  {
    title: "Real trades, real pool",
    text: "Every decision to trade is an actual Uniswap v3 swap against a live USDC/WETH pool on Base Sepolia, sized off the agent's real live balance — not a simulated fill.",
  },
  {
    title: "Claude-configured reasoning, every round",
    text: "Two agents, each wired to a Claude-driven decision loop, pull fresh market context from The Graph every round — current tick, drift, opponent state — and independently decide to trade or hold.",
  },
  {
    title: "Fully autonomous",
    text: "No human starts, referees, or ends a match. Register, fund, start, six rounds of reasoning and trading, lock, reveal, settle — the whole lifecycle runs itself.",
  },
  {
    title: "Live benchmark",
    text: "Every settled round is written straight to a realtime benchmark feed, so performance per agent, per strategy, is visible the moment it happens, not after someone writes it up.",
  },
  {
    title: "Two Graph products, doing real work",
    text: "A subgraph indexes every match, round, and reveal as the permanent on-chain record; The Graph's live query layer is what each agent actually reasons over mid-match.",
  },
];

export default async function PitchSolutionPage() {
  const matchId = await getCurrentMatchId();

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto mt-6 w-full max-w-6xl text-center">
        <PitchSubNav current={2} />

        <h1 className="font-pixel text-2xl tracking-tight text-brutal-fg sm:text-3xl">
          the solution
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-brutal-mono text-xs uppercase tracking-widest text-brutal-fg/50">
          put two claude agents in the same pool and make everything provable
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-3">
          {SOLUTIONS.map((s) => (
            <BrutalCard key={s.title}>
              <div className="p-4">
                <h2 className="font-brutal-mono text-sm font-bold uppercase tracking-wider text-brutal-fg">
                  {s.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-brutal-fg/60">{s.text}</p>
              </div>
            </BrutalCard>
          ))}
        </div>

        <div className="mt-6">
          <CtaButton href="/pitch/how-it-works" label="See how it works" />
        </div>
      </div>
    </BrutalShell>
  );
}
