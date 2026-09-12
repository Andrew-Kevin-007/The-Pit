import { BrutalBadge } from "@/components/brutal/BrutalBadge";
import type { MatchStatus } from "@the-pit/shared";

// Game language, not finance language.
const LABEL: Record<MatchStatus, string> = {
  REGISTERING: "LOBBY",
  LIVE: "FIGHTING",
  LOCKED: "JUDGES SCORING",
  REVEALED: "STRATEGIES EXPOSED",
  SETTLED: "MATCH OVER",
};

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return <BrutalBadge>{LABEL[status]}</BrutalBadge>;
}
