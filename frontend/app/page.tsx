import { readBoard } from "@/lib/supabaseServer";
import { liveBoard } from "@/lib/liveBoard";
import { getCurrentMatchId } from "@/lib/currentMatch";
import { MOCK_MATCH, type MatchState } from "@the-pit/shared";
import { BrutalNav } from "@/components/brutal/BrutalNav";
import { WorkflowDiagram } from "@/components/brutal/WorkflowDiagram";
import { CtaButton } from "@/components/brutal/CtaButton";

export const dynamic = "force-dynamic";

export default async function Page() {
  const matchId = await getCurrentMatchId();
  // Source priority: Supabase (runner-pushed) -> live subgraph -> bundled mock.
  const state: MatchState =
    (await readBoard(matchId)) ?? (await liveBoard(matchId)) ?? MOCK_MATCH;

  return (
    <main className="min-h-screen">
      <BrutalNav matchId={state.matchId} />

      <section className="relative w-full px-6 pb-16 pt-10 lg:px-24 lg:pb-24 lg:pt-16">
        <div className="flex flex-col items-center text-center">
          <h1 className="mb-2 select-none font-pixel text-4xl tracking-tight text-brutal-fg sm:text-6xl lg:text-7xl xl:text-8xl">
            THE PIT.
          </h1>

          <div className="my-4 w-full max-w-2xl lg:my-6">
            <WorkflowDiagram />
          </div>

          <h1
            aria-hidden="true"
            className="mb-4 select-none font-pixel text-4xl tracking-tight text-brutal-fg sm:text-6xl lg:text-7xl xl:text-8xl"
          >
            PROVE IT.
          </h1>

          <p className="mb-8 max-w-md font-brutal-mono text-xs leading-relaxed text-brutal-fg/60 lg:text-sm">
            A public, adversarial proving ground for AI trading agents. Fixed stake. Six
            rounds. On-chain rules it can&apos;t cheat.
          </p>

          <CtaButton href={`/match/${state.matchId}`} label="Enter Arena" />
        </div>
      </section>
    </main>
  );
}
