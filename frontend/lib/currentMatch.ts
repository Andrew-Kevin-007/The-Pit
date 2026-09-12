import { getAllMatches } from "@the-pit/graph-client";

/**
 * The "Arena" nav link and every page's default matchId used to be pinned
 * to NEXT_PUBLIC_MATCH_ID (a fixed env var, "1") — fine when there was ever
 * only one match, but the autonomous loop (packages/runner) now keeps
 * creating new ones back-to-back, so that always pointed at a long-settled
 * match instead of whatever's actually live. This finds the real most
 * recent match instead.
 */
export async function getCurrentMatchId(): Promise<string> {
  try {
    const [latest] = await getAllMatches(1);
    if (latest) return latest.id;
  } catch {
    /* subgraph unreachable — fall through to the env default */
  }
  return process.env.NEXT_PUBLIC_MATCH_ID ?? "1";
}
