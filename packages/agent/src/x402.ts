/**
 * Stretch (Graph Track 2, explicitly rewarded): let the agent pay per query
 * autonomously with x402.
 *
 * Wrap any fetch to a paid Graph gateway. On HTTP 402 the wrapper reads the
 * payment challenge, signs a micropayment from the agent's own Base Sepolia
 * wallet, retries with the `X-PAYMENT` header, and meters the spend so the demo
 * can show the agent paying its own way.
 *
 * Real signing lives behind `signPayment` — implement with the x402 client, or
 * hand the 402 body to the `okx-agent-payments-protocol` skill if the handshake
 * is fiddly. Until AGENT_X402_PRIVATE_KEY is set this is a no-op passthrough.
 */
export interface Meter {
  queries: number;
  totalPaidBaseUnits: bigint;
  byMatch: Record<string, bigint>;
}

export const meter: Meter = { queries: 0, totalPaidBaseUnits: 0n, byMatch: {} };

export interface X402Opts {
  matchId?: string;
  signPayment?: (challenge: unknown) => Promise<{ header: string; amountBaseUnits: bigint }>;
}

export async function payingFetch(
  input: string,
  init: RequestInit = {},
  opts: X402Opts = {},
): Promise<Response> {
  meter.queries += 1;
  const res = await fetch(input, init);
  if (res.status !== 402) return res;

  const challenge = await res.clone().json().catch(() => ({}));
  const signer = opts.signPayment ?? defaultSigner();
  if (!signer) {
    // no wallet configured — surface the 402 so the caller can decide
    return res;
  }
  const { header, amountBaseUnits } = await signer(challenge);
  meter.totalPaidBaseUnits += amountBaseUnits;
  if (opts.matchId) {
    meter.byMatch[opts.matchId] = (meter.byMatch[opts.matchId] ?? 0n) + amountBaseUnits;
  }
  return fetch(input, {
    ...init,
    headers: { ...(init.headers ?? {}), "X-PAYMENT": header },
  });
}

function defaultSigner(): X402Opts["signPayment"] | null {
  const pk = process.env.AGENT_X402_PRIVATE_KEY;
  if (!pk) return null;
  return async (_challenge: unknown) => {
    // TODO: implement with the x402 client (permit2 / exact scheme).
    // See the okx-agent-payments-protocol skill for the X-PAYMENT construction.
    throw new Error("x402 signer not implemented yet — see packages/agent/src/x402.ts");
  };
}

export function meterSummary(): string {
  const usd = Number(meter.totalPaidBaseUnits) / 1e6;
  return `x402: ${meter.queries} queries, $${usd.toFixed(4)} paid total`;
}
