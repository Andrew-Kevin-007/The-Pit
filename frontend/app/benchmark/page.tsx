import { getBenchmarks } from "@/lib/benchmark";
import { getCurrentMatchId } from "@/lib/currentMatch";
import { BrutalShell } from "@/components/brutal/BrutalShell";
import { BenchmarkFeed } from "@/components/pit/BenchmarkFeed";

export const dynamic = "force-dynamic";

export default async function BenchmarkPage() {
  const [matchId, rows] = await Promise.all([getCurrentMatchId(), getBenchmarks(100)]);

  return (
    <BrutalShell matchId={matchId} className="px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <div className="mt-6 text-center">
          <h1 className="select-none font-pixel text-4xl tracking-tight sm:text-5xl">Benchmark</h1>
          <p className="mt-2 text-xs uppercase tracking-wider text-brutal-fg/50">
            per-agent performance, written the instant a match settles {"—"} before the subgraph
            even catches up.
          </p>
        </div>

        <div className="mt-10">
          <BenchmarkFeed initial={rows} />
        </div>
      </div>
    </BrutalShell>
  );
}
