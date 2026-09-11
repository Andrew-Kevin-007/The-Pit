import { readBoard } from "@/lib/supabaseServer";
import { liveBoard } from "@/lib/liveBoard";
import { MOCK_MATCH, type MatchState } from "@the-pit/shared";
import ArenaClient from "./ArenaClient";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: { matchId: string } }) {
  const { matchId } = params;
  const initial: MatchState =
    (await readBoard(matchId)) ?? (await liveBoard(matchId)) ?? MOCK_MATCH;

  return <ArenaClient matchId={matchId} initial={initial} />;
}
