import { supabaseServer } from "@/lib/supabaseServer";

export interface BenchmarkRow {
  match_id: string;
  agent: string;
  handle: string | null;
  strategy: string | null;
  final_usdc: string;
  pnl: string;
  rebate: string;
  won: boolean;
  trades_total: number;
  settled_at: string;
}

/** Fast, realtime-queryable agent performance — written the instant a match
 *  settles, well before the subgraph finishes indexing it (supabase/schema.sql). */
export async function getBenchmarks(limit = 100): Promise<BenchmarkRow[]> {
  const sb = supabaseServer();
  if (!sb) return [];
  const { data, error } = await sb
    .from("agent_benchmarks")
    .select("*")
    .order("settled_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data as BenchmarkRow[];
}
