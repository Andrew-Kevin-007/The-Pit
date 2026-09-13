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

function isRetryableError(err: unknown): boolean {
  const status = (err as { response?: { status?: number } } | undefined)?.response?.status;
  if (status === 429) return true;
  if (typeof status === "number") return status >= 500;
  // no HTTP response at all (fetch rejected, DNS hiccup, reset) — worth a retry.
  return true;
}

export interface RetryOptions {
  tries?: number;
  baseDelayMs?: number;
  label?: string;
}

/**
 * Subgraph Studio's Development Query URLs (what every path in this repo uses,
 * on purpose — see docs/the-graph/README.md) are dev/testing endpoints with a
 * tight per-second rate limit. Total query volume per match is small, but it
 * arrives bursty: two agents reason concurrently each round, each firing two
 * subgraph queries at once, so 4 requests can land in the same instant even
 * though only ~24 are made across a whole 6-round match. That burst is what
 * trips a 429, not sustained load.
 *
 * Retry with exponential backoff + jitter absorbs that burst. A genuine query
 * error (400, GraphQL validation) is deliberately NOT retried — it won't
 * succeed on a second try, and retrying would just hide the real bug.
 */
export async function retryable<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const tries = opts.tries ?? 5;
  const baseDelayMs = opts.baseDelayMs ?? 700;
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      if (!isRetryableError(e) || i === tries - 1) throw e;
      const delayMs = baseDelayMs * 2 ** i + Math.random() * 300;
      console.warn(
        `  [graph-client] ${opts.label ?? "query"} failed (attempt ${i + 1}/${tries}), retrying in ${Math.round(delayMs)}ms: ${(e as Error)?.message ?? e}`,
      );
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
