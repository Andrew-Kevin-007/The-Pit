/**
 * Match lifecycle, driven off @the-pit/shared's state model.
 *
 *   fund -> register (commit) -> start -> [6 x (run round, lockRound)] -> reveal -> settle
 *
 * mode "mock":  no chain; balances/trades are synthesized; used in Phase 1 so the
 *               board + agent have something to render before contracts exist.
 * mode "chain": real viem writes to Amalraj's MatchController + on-chain USDC
 *               reads at round lock; used from Phase 2.
 */
import {
  ROUND_COUNT,
  ROUND_SECONDS,
  STAKE_USDC,
  newMatchState,
  type AgentRef,
  type MatchState,
  type RoundIndex,
} from "@the-pit/shared";
import { canonicalConfigString, type StrategyConfig } from "@the-pit/shared";
import { keccak256, toHex, stringToBytes, concatBytes, type Address } from "viem";
import { runRound, type Decision } from "@the-pit/agent";
import { matchControllerAbi } from "./abis.js";
import { readUsdcBalance, publicClient, walletClient } from "./chain.js";
import { createPitRouterExecutor } from "./execute.js";
import { boardClient, pushBoard, recordBenchmarks } from "./board.js";
import { loadEnv, requireChain, type RunnerEnv } from "./env.js";

export type Mode = "mock" | "chain";

export interface AgentPlan extends AgentRef {
  config: StrategyConfig;
  salt: `0x${string}`;
  /** chain mode only: this agent's own signer — real trades are its wallet's
   *  own PitRouter.swap() calls, never the runner's. No key, no real trading. */
  privateKey?: `0x${string}`;
  /** mock only: pnl (base units) the agent ends each round with, per round */
  mockRoundPnl?: number[];
}

export interface RunOptions {
  mode: Mode;
  matchId: string;
  agents: AgentPlan[];
  /** compress the 90s rounds for rehearsal; real matches use ROUND_SECONDS */
  roundSeconds?: number;
  onState?: (s: MatchState) => Promise<void> | void;
}

function commitHash(cfg: StrategyConfig, salt: `0x${string}`): `0x${string}` {
  const preimage = concatBytes([
    stringToBytes(canonicalConfigString(cfg)),
    stringToBytes("\n"),
    Uint8Array.from(Buffer.from(salt.slice(2), "hex")),
  ]);
  return keccak256(preimage);
}

export async function runMatch(opts: RunOptions): Promise<MatchState> {
  const env = loadEnv();
  const sb = boardClient(env);
  const roundSecs = opts.roundSeconds ?? ROUND_SECONDS;
  const state = newMatchState(
    opts.matchId,
    opts.agents.map((a) => ({ wallet: a.wallet, handle: a.handle, strategy: a.strategy })),
  );
  state.poolId = env.poolId;

  const emit = async () => {
    await pushBoard(sb, state);
    if (opts.onState) await opts.onState(state);
  };

  // ---- REGISTERING: fund + register + commit ----
  for (const a of opts.agents) {
    const hash = commitHash(a.config, a.salt);
    if (opts.mode === "chain") {
      requireChain(env);
      await chainRegister(env, opts.matchId, a.wallet as Address, hash);
    } else {
      console.log(`[mock] register ${a.handle} commit=${hash.slice(0, 10)}…`);
    }
  }
  await emit();

  // ---- LIVE: start ----
  state.status = "LIVE";
  if (opts.mode === "chain") {
    requireChain(env);
    await chainWrite(env, "startMatch", [BigInt(opts.matchId)]);
  }
  // Capture the match start AFTER startMatch confirms, not before — the tx
  // itself takes real time to land, and the contract's own ROUND_SECONDS
  // clock only starts ticking once it's mined. Capturing earlier made this
  // process think each round's window closed before the contract's actually
  // did, so lockRound() kept reverting RoundNotElapsed no matter how many
  // times it retried (a real skew, not the usual transient RPC lag).
  const matchStartUnix = Math.floor(Date.now() / 1000);
  state.startTime = matchStartUnix;
  await emit();

  // ---- 6 rounds ----
  for (let r = 0 as RoundIndex; r < ROUND_COUNT; r = (r + 1) as RoundIndex) {
    state.currentRound = r;
    state.rounds[r]!.startedAt = Math.floor(Date.now() / 1000);
    await emit();

    let roundDecisions: Record<string, Decision[]> = {};
    if (opts.mode === "chain") {
      requireChain(env);
      if (!env.usdc || !env.pitRouter) throw new Error("USDC_ADDRESS + PIT_ROUTER_ADDRESS required for chain trading");
      // each agent reasons over live Graph context and (maybe) trades through
      // its OWN wallet — real decisions, real execution, no fixed/blind swap.
      const results = await Promise.allSettled(
        opts.agents.map(async (a, i) => {
          if (!a.privateKey) return { wallet: a.wallet, decisions: [] as Decision[] };
          // Agents start their round concurrently, so their AgentHistory
          // queries land on the subgraph in the same instant — and on a
          // 429, both back off on a similar schedule and collide again on
          // the next attempt, staying in lockstep. A small stagger between
          // agents breaks that: retries desync instead of re-colliding.
          if (i > 0) await sleep(i * 600);
          const execute = createPitRouterExecutor({
            agentPrivateKey: a.privateKey,
            matchId: opts.matchId,
            pitRouter: env.pitRouter!,
            usdc: env.usdc!,
            rpcUrl: env.rpcUrl,
          });
          const decisions = await runRound(
            {
              matchId: opts.matchId,
              agent: a.wallet,
              poolId: env.poolId ?? "",
              strategyId: a.config.strategy,
              maxTradesPerRound: a.config.maxTradesPerRound,
              execute,
              tickMs: 8_000,
            },
            r,
            matchStartUnix,
          );
          return { wallet: a.wallet, decisions };
        }),
      );
      // one agent's trade failing (after its own internal retries) must never
      // take down the other agents' rounds, let alone the whole match.
      for (const res of results) {
        if (res.status === "fulfilled") {
          roundDecisions[res.value.wallet] = res.value.decisions;
        } else {
          console.warn(`  [round ${r}] an agent's trading failed: ${(res.reason as Error)?.message ?? res.reason}`);
        }
      }
      // Don't just add a flat buffer after however long trading happened to
      // take — if an agent's execute() throws (its own retries exhausted),
      // runRound() rejects early and Promise.allSettled can resolve well
      // before the round's real window is up. Wait until the round has
      // actually elapsed against matchStartUnix, however fast/slow trading
      // was, plus a small safety margin for lockRound's strict on-chain check.
      const roundEndUnix = matchStartUnix + (r + 1) * roundSecs + 3;
      const waitMs = roundEndUnix * 1000 - Date.now();
      if (waitMs > 0) await sleep(waitMs);
    } else {
      await sleep(roundSecs * 1000);
    }

    // lock: MatchController.lockRound() reads every participant's on-chain
    // USDC balance itself and emits one RoundLocked per agent — call it once
    // per round, not once per agent (a second call for the same round reverts
    // OutOfOrderRound).
    if (opts.mode === "chain") {
      await chainWrite(env, "lockRound", [BigInt(opts.matchId), r]);
    }
    const lockTs = Math.floor(Date.now() / 1000);
    for (let i = 0; i < opts.agents.length; i++) {
      const a = opts.agents[i]!;
      let bal: bigint;
      if (opts.mode === "chain") {
        if (!env.usdc) throw new Error("USDC_ADDRESS required for chain round-lock");
        bal = await readUsdcBalance(env, env.usdc, a.wallet as Address);
      } else {
        const pnl = a.mockRoundPnl?.[r] ?? mockPnl(i, r);
        bal = STAKE_USDC + BigInt(pnl);
      }
      const decisions = roundDecisions[a.wallet] ?? [];
      const realTrades = decisions.filter((d) => d.action.kind === "swap").length;
      state.rounds[r]!.balances[a.wallet] = bal.toString();
      state.rounds[r]!.trades[a.wallet] = opts.mode === "mock" ? (i % 2) + 1 : realTrades;
      state.rounds[r]!.commentary[a.wallet] =
        opts.mode === "mock" ? mockLine(a.strategy, r) : decisions[decisions.length - 1]?.commentary ?? "";
      state.rounds[r]!.txHashes[a.wallet] = decisions
        .map((d) => d.txHash)
        .filter((h): h is string => !!h);
    }
    state.rounds[r]!.lockedAt = lockTs;
    if (r === ROUND_COUNT - 1) state.status = "LOCKED";
    await emit();
  }
  state.currentRound = null;

  // ---- REVEALED ----
  for (const a of opts.agents) {
    if (opts.mode === "chain") {
      await chainWrite(env, "reveal", [
        BigInt(opts.matchId),
        a.wallet as Address,
        canonicalConfigString(a.config),
        a.salt,
      ]);
    }
  }
  state.status = "REVEALED";
  await emit();

  // ---- SETTLED ----
  if (opts.mode === "chain") {
    await chainWrite(env, "settle", [BigInt(opts.matchId)]);
  }
  const last = state.rounds[ROUND_COUNT - 1]!.balances;
  let winner = opts.agents[0]!.wallet;
  for (const a of opts.agents) {
    if (BigInt(last[a.wallet] ?? "0") > BigInt(last[winner] ?? "0")) winner = a.wallet;
  }
  state.winner = winner;
  state.settledAt = Math.floor(Date.now() / 1000);
  state.results = opts.agents.map((a) => {
    const finalUsdc = last[a.wallet] ?? STAKE_USDC.toString();
    return {
      wallet: a.wallet,
      finalUsdc,
      pnl: (BigInt(finalUsdc) - STAKE_USDC).toString(),
      rebate: opts.mode === "mock" ? "12000" : "0",
      won: a.wallet === winner,
    };
  });
  state.status = "SETTLED";
  await emit();

  const strategyByWallet: Record<string, string> = {};
  const tradesByWallet: Record<string, number> = {};
  for (const a of opts.agents) {
    strategyByWallet[a.wallet] = a.strategy;
    tradesByWallet[a.wallet] = state.rounds.reduce((sum, r) => sum + (r.trades[a.wallet] ?? 0), 0);
  }
  await recordBenchmarks(sb, state, strategyByWallet, tradesByWallet);

  return state;
}

// ---------- chain helpers ----------

const sleepMs = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * The public RPC is load-balanced across nodes without strong
 * read-your-writes consistency: a call can revert (or, worse, its receipt
 * come back with status "reverted") against a node that hasn't yet seen a
 * just-confirmed prior tx, then succeed seconds later with no code change.
 * `waitForTransactionReceipt` does NOT throw on a reverted receipt — check
 * status explicitly, and retry the whole call (fresh tx, fresh nonce) rather
 * than silently treating a revert as success.
 */
async function writeAndConfirm(
  env: RunnerEnv,
  label: string,
  send: () => Promise<`0x${string}`>,
  tries = 3,
): Promise<`0x${string}`> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const hash = await send();
      const receipt = await publicClient(env).waitForTransactionReceipt({ hash });
      if (receipt.status === "success") {
        console.log(`[chain] ${label} -> ${hash}`);
        return hash;
      }
      lastErr = new Error(`${label} reverted on-chain (status=${receipt.status}), tx ${hash}`);
    } catch (e) {
      lastErr = e;
    }
    console.warn(`  [retry] ${label} attempt ${i + 1}/${tries} failed: ${(lastErr as Error).message}`);
    if (i < tries - 1) await sleepMs(4000);
  }
  throw lastErr;
}

async function chainWrite(
  env: RunnerEnv,
  fn: "startMatch" | "lockRound" | "reveal" | "settle",
  args: readonly unknown[],
): Promise<void> {
  requireChain(env);
  const wc = walletClient(env);
  await writeAndConfirm(env, `${fn}(${args.join(",")})`, () =>
    wc.writeContract({ address: env.matchController, abi: matchControllerAbi, functionName: fn, args: args as never }),
  );
}

async function chainRegister(
  env: RunnerEnv,
  matchId: string,
  agent: Address,
  commit: `0x${string}`,
): Promise<void> {
  requireChain(env);
  const wc = walletClient(env);
  await writeAndConfirm(env, `register(${agent})`, () =>
    wc.writeContract({
      address: env.matchController,
      abi: matchControllerAbi,
      functionName: "register",
      args: [BigInt(matchId), agent, commit, STAKE_USDC],
    }),
  );
}

// ---------- mock helpers ----------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function mockPnl(agentIdx: number, round: RoundIndex): number {
  // deterministic-ish drift so the board + leader indicator have signal.
  // idx 2 is the passive baseline — stays flat (fee rebate only).
  // Scaled as a fraction of STAKE_USDC (now $1 = 1_000_000 base units) so the
  // coarse-leader buckets (1% / 4% / 12% of one stake) actually move across
  // a 6-round match instead of staying pinned at EVEN.
  const base = [44_000, -28_000, 0][agentIdx % 3]!; // ~4.4% / -2.8% of stake per round
  if (agentIdx % 3 === 2) return 0;
  return base * (round + 1) + (agentIdx === 0 ? -8_000 * round : 6_000 * round);
}

function mockLine(strategy: string, round: RoundIndex): string {
  const lines: Record<string, string[]> = {
    momentum: ["Rode the drift.", "Trend held, added.", "Trimmed into strength."],
    "mean-reversion": ["Faded the pop.", "Reversion paid.", "Sat out the chop."],
    "passive-hodl": ["Held.", "Still holding.", "Fees rebate anyway."],
  };
  const arr = lines[strategy] ?? ["…"];
  return arr[round % arr.length]!;
}
