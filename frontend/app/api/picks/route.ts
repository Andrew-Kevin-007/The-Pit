import { NextResponse } from "next/server";
import { recordPick } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  let body: { matchId?: string; side?: string; clientId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }
  const { matchId, side, clientId } = body;
  if (!matchId || !side || !clientId) {
    return NextResponse.json({ ok: false, error: "matchId, side, clientId required" }, { status: 400 });
  }
  // Tracked for the demo only — not Sybil-resistant. One row per
  // (client_id, match_id) enforced by a DB unique index.
  const res = await recordPick(matchId, side, clientId);
  return NextResponse.json(res, { status: res.ok ? 200 : 500 });
}
