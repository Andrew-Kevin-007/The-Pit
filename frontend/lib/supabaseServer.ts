import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { MatchState } from "@the-pit/shared";

export function supabaseServer(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function readBoard(matchId: string): Promise<MatchState | null> {
  const sb = supabaseServer();
  if (!sb) return null;
  const { data, error } = await sb
    .from("board_state")
    .select("state")
    .eq("match_id", matchId)
    .maybeSingle();
  if (error || !data) return null;
  return data.state as MatchState;
}

export async function recordPick(
  matchId: string,
  side: string,
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseServer();
  if (!sb) return { ok: false, error: "supabase not configured" };
  const { error } = await sb.from("picks").insert({
    match_id: matchId,
    side,
    client_id: clientId,
    created_at: new Date().toISOString(),
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}
