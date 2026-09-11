/**
 * Endpoints + auth for both subgraphs.
 *
 * All values come from the environment so the same package works from the
 * Next.js server, the runner, and the agent. Never expose GRAPH_API_KEY to the
 * browser — the board calls these functions from server components / route
 * handlers only.
 */

export interface GraphConfig {
  matchUrl: string;
  messariUrl: string;
  apiKey: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): GraphConfig {
  return {
    matchUrl: env.MATCH_SUBGRAPH_URL ?? "",
    messariUrl: env.MESSARI_SUBGRAPH_URL ?? "",
    apiKey: env.GRAPH_API_KEY ?? "",
  };
}

export function authHeaders(cfg: GraphConfig): Record<string, string> {
  return cfg.apiKey ? { Authorization: `Bearer ${cfg.apiKey}` } : {};
}

export function assertConfigured(cfg: GraphConfig): void {
  const missing: string[] = [];
  if (!cfg.matchUrl) missing.push("MATCH_SUBGRAPH_URL");
  if (!cfg.messariUrl) missing.push("MESSARI_SUBGRAPH_URL");
  if (missing.length) {
    throw new Error(
      `graph-client: missing env ${missing.join(", ")}. ` +
        `Fill these from the Subgraph Studio "Development Query URL" after deploy.`,
    );
  }
}
