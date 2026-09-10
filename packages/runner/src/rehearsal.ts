/**
 * Phase 5 — full 2-agent rehearsal (a 1v1 duel — the frontend's whole Arena/
 * Result UI is built for exactly two fighters: AgentCard side="left"/"right",
 * coarseLeader()'s two-way split, FighterSelect's two buttons. A 3rd agent
 * silently falls off the edge of that UI, so real matches register two.
 * AGENT_C_PRIVATE_KEY / passive-hodl stays available but unused here — it was
 * always meant as a non-trading benchmark, not a "fighter".
 *
 * mock mode: 2 placeholder wallets, no signing, no chain — board/UI smoke test.
 * chain mode: the 2 REAL funded agent wallets (AGENT_A/B_PRIVATE_KEY), each
 * trading through its own signer during live rounds via @the-pit/agent's real
 * strategies — no hardcoded placeholder addresses, no blind fixed-size swap.
 */
import { createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import type { StrategyConfig } from "@the-pit/shared";
import { loadConfig, waitForSettlement, getMatchBoard } from "@the-pit/graph-client";
import { runMatch, type AgentPlan, type Mode } from "./lifecycle.js";
import { ensureStaked } from "./topUp.js";
import { loadEnv } from "./env.js";

function cfg(strategy: string, params: StrategyConfig["params"]): StrategyConfig {
  return {
    strategy,
    version: "0.0.3",
    params,
    maxTradesPerRound: 1,
    usesGraphHistory: strategy !== "passive-hodl",
  };
}

const MOCK_AGENTS: AgentPlan[] = [
  {
    wallet: "0x1111111111111111111111111111111111111111",
    handle: "momentum-a",
    strategy: "momentum",
    salt: "0x0000000000000000000000000000000000000000000000000000000000000001",
    config: cfg("momentum", { lookback: 5, sizePct: 40 }),
  },
  {
    wallet: "0x2222222222222222222222222222222222222222",
    handle: "meanrev-b",
    strategy: "mean-reversion",
    salt: "0x0000000000000000000000000000000000000000000000000000000000000002",
    config: cfg("mean-reversion", { band: 2, sizePct: 35 }),
  },
];

const REAL_AGENT_SPECS = [
  {
    envKey: "AGENT_A_PRIVATE_KEY",
    handle: "momentum-a",
    strategy: "momentum",
    params: { sizePct: 30 },
    salt: "0x0000000000000000000000000000000000000000000000000000000000000011",
  },
  {
    envKey: "AGENT_B_PRIVATE_KEY",
    handle: "meanrev-b",
    strategy: "mean-reversion",
    params: { sizePct: 25 },
    salt: "0x0000000000000000000000000000000000000000000000000000000000000022",
  },
] as const;

function realAgentsFromEnv(): AgentPlan[] {
  return REAL_AGENT_SPECS.map((spec) => {
    const key = process.env[spec.envKey];
    if (!key || !key.startsWith("0x")) throw new Error(`${spec.envKey} required for a real chain rehearsal`);
    const privateKey = key as `0x${string}`;
    return {
      wallet: privateKeyToAccount(privateKey).address,
      handle: spec.handle,
      strategy: spec.strategy,
      config: cfg(spec.strategy, spec.params),
      salt: spec.salt,
      privateKey,
    };
  });
}

const participantsOfAbi = parseAbi([
  "function participantsOf(uint256 matchId) external view returns (address[])",
]);

async function findFreshMatchId(
  rpcUrl: string,
  matchController: `0x${string}`,
  startFrom = 1,
): Promise<string> {
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const rangeEnd = startFrom + 1000;
  for (let id = startFrom; id < rangeEnd; id++) {
    const participants = await client.readContract({
      address: matchController,
      abi: participantsOfAbi,
      functionName: "participantsOf",
      args: [BigInt(id)],
    });
    if (participants.length === 0) return String(id);
  }
  throw new Error(`no fresh matchId found in range ${startFrom}..${rangeEnd - 1}`);
}

export async function rehearse(mode: Mode, matchId?: string, searchFrom = 1): Promise<string> {
  const env = loadEnv();
  let agents: AgentPlan[];
  let resolvedMatchId = matchId;

  if (mode === "chain") {
    if (!env.usdc) throw new Error("USDC_ADDRESS required for a chain rehearsal");
    agents = realAgentsFromEnv();

    console.log("Step 0: checking/topping up agent USDC balances...");
    for (const a of agents) {
      if (a.privateKey) await ensureStaked(a.privateKey, env.usdc, env.rpcUrl);
    }

    if (!resolvedMatchId) {
      if (!env.matchController) throw new Error("MATCH_CONTROLLER_ADDRESS required to auto-pick a fresh matchId");
      resolvedMatchId = await findFreshMatchId(env.rpcUrl, env.matchController, searchFrom);
    }
  } else {
    agents = MOCK_AGENTS;
    resolvedMatchId = resolvedMatchId ?? "1";
  }

  console.log(`\n=== rehearsal: mode=${mode} match=${resolvedMatchId} (${agents.length} agents) ===\n`);
  const final = await runMatch({
    mode,
    matchId: resolvedMatchId,
    agents,
    // mock mode compresses rounds for a fast smoke test; chain mode must run
    // the real on-chain ROUND_SECONDS (immutable on MatchController) or every
    // lockRound() call reverts RoundNotElapsed.
    roundSeconds: mode === "mock" ? 3 : undefined,
  });

  console.log(`\nlocal result: winner=${final.winner}`);
  for (const r of final.results) {
    console.log(`  ${r.wallet.slice(0, 8)} pnl=${r.pnl} rebate=${r.rebate} won=${r.won}`);
  }

  if (mode !== "chain") {
    console.log("\n(mock mode — skipping subgraph assertions)\n");
    return resolvedMatchId;
  }

  const gc = loadConfig();
  if (!gc.matchUrl) {
    console.warn("MATCH_SUBGRAPH_URL not set — cannot assert subgraph record");
    return resolvedMatchId;
  }

  console.log("\nwaiting for the-pit-match to index MatchSettled…");
  const settled = await waitForSettlement(resolvedMatchId, { tries: 40, delayMs: 3000 });
  console.log("  ✓ match-events subgraph has SETTLED:", JSON.stringify(settled).slice(0, 200));

  const board = await getMatchBoard(resolvedMatchId);
  if (!board || board.rounds.length !== 6) {
    throw new Error(`expected 6 rounds in subgraph, got ${board?.rounds.length ?? 0}`);
  }
  console.log("  ✓ 6 rounds present with locks");
  console.log("\n=== rehearsal passed ===\n");
  return resolvedMatchId;
}
