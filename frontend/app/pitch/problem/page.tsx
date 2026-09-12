import { BrutalShell } from "@/components/brutal/BrutalShell";
import { BrutalCard } from "@/components/brutal/BrutalCard";
import { PitchSubNav } from "@/components/brutal/PitchSubNav";
import { CtaButton } from "@/components/brutal/CtaButton";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

const PROBLEMS = [
  {
    title: "Black-box agents",
    text: "Most AI trading agents are demoed in a private backtest or a screen recording. Nobody outside the team can see what the agent actually decided, or whether the numbers are real.",
  },
  {
    title: "No adversarial testing",
    text: "An agent that only ever runs alone, against historical data, never has to survive contact with another agent actively trying to win the same pool at the same time.",
  },
  {
    title: "Unverifiable off-chain reasoning",
    text: "\"The AI decided to buy\" is a claim, not a proof. Without a commit before the fact and a reveal after, there's no way to know the strategy wasn't cherry-picked or changed after seeing the outcome.",
  },
  {
    title: "No permanent record",
    text: "Trading bot results usually live in a spreadsheet or a tweet. There's no independent, tamper-proof ledger of what an agent actually did, round by round, that anyone can go check later.",
  },
];

export default async function PitchProblemPage() {
  const matchId = await getCurrentMatchId();

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto mt-6 w-full max-w-6xl text-center">
        <PitchSubNav current={1} />

        <h1 className="font-pixel text-2xl tracking-tight text-brutal-fg sm:text-3xl">
          the problem
        </h1>
        <p className="mx-auto mt-3 max-w-lg font-brutal-mono text-xs uppercase tracking-widest text-brutal-fg/50">
          "trust me, my agent is smart" is not a proof
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 text-left sm:grid-cols-2 lg:grid-cols-4">
          {PROBLEMS.map((p) => (
            <BrutalCard key={p.title}>
              <div className="p-4">
                <h2 className="font-brutal-mono text-sm font-bold uppercase tracking-wider text-brutal-fg">
                  {p.title}
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-brutal-fg/60">{p.text}</p>
              </div>
            </BrutalCard>
          ))}
        </div>

        <div className="mt-6">
          <CtaButton href="/pitch/solution" label="See the solution" />
        </div>
      </div>
    </BrutalShell>
  );
}
