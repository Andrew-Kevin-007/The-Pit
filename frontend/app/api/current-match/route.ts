import { NextResponse } from "next/server";
import { getCurrentMatchId } from "@/lib/currentMatch";

export const dynamic = "force-dynamic";

export async function GET() {
  const matchId = await getCurrentMatchId();
  return NextResponse.json({ matchId }, { headers: { "cache-control": "no-store" } });
}
