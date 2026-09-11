import { NextResponse } from "next/server";
import { readBoard } from "@/lib/supabaseServer";
import { liveBoard } from "@/lib/liveBoard";
import { MOCK_MATCH } from "@the-pit/shared";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { matchId: string } },
) {
  const { matchId } = params;
  const state =
    (await readBoard(matchId)) ?? (await liveBoard(matchId)) ?? MOCK_MATCH;
  return NextResponse.json(state, {
    headers: { "cache-control": "no-store" },
  });
}
