import type { MatchStatus } from "@the-pit/shared";

// Game language, not finance language — README "UX Principles" #6.
const LABEL: Record<MatchStatus, string> = {
  REGISTERING: "LOBBY",
  LIVE: "FIGHTING",
  LOCKED: "JUDGES SCORING",
  REVEALED: "STRATEGIES EXPOSED",
  SETTLED: "MATCH OVER",
};

const COLOR: Record<MatchStatus, string> = {
  REGISTERING: "border-pit-dim text-pit-dim",
  LIVE: "border-pit-green text-pit-green",
  LOCKED: "border-pit-yellow text-pit-yellow",
  REVEALED: "border-pit-yellow text-pit-yellow",
  SETTLED: "border-pit-white text-pit-white",
};

export function MatchStatusChip({ status }: { status: MatchStatus }) {
  return (
    <span
      className={`inline-block rounded-full border px-3 py-1 font-mono text-xs uppercase tracking-wider ${COLOR[status]}`}
    >
      {LABEL[status]}
    </span>
  );
}
