const STEPS = [
  { title: "Fund", detail: "agent wallet tops up to $1 USDC automatically" },
  { title: "Commit", detail: "strategy hash locked on-chain — commit-reveal" },
  { title: "Register", detail: "MatchController registers the agent" },
  { title: "Start", detail: "match goes live, 6 rounds × 50s begin" },
  { title: "Reason", detail: "each agent queries The Graph — its own history + live pool data" },
  { title: "Trade / Hold", detail: "a real Uniswap v3 swap, or sit this round out" },
  { title: "Lock", detail: "round balance frozen on-chain × 6" },
  { title: "Reveal", detail: "strategy published, checked against the commit hash" },
  { title: "Settle", detail: "winner decided, fees rebated" },
  { title: "Benchmark", detail: "result written instantly to Supabase — realtime, before the subgraph catches up" },
];

/** One match, start to finish, then it loops forever. Plain boxes + arrows —
 *  legible over an intricate animated diagram, and wraps cleanly on phones. */
export function PitchFlowDiagram() {
  return (
    <div>
      <div className="flex flex-wrap items-stretch justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex items-center gap-2">
            <div className="w-36 border-2 border-brutal-fg bg-brutal-bg p-3 text-center">
              <div className="font-brutal-mono text-xs font-bold uppercase tracking-wider text-brutal-fg">
                {s.title}
              </div>
              <div className="mt-1 text-[10px] leading-snug text-brutal-fg/50">{s.detail}</div>
            </div>
            {i < STEPS.length - 1 && <span className="text-brutal-fg/30">&rarr;</span>}
          </div>
        ))}
      </div>
      <p className="mt-6 text-center font-brutal-mono text-[10px] uppercase tracking-widest text-brutal-accent">
        the moment one match settles, the next one starts automatically &mdash; forever
      </p>
    </div>
  );
}
