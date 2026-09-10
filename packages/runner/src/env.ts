export interface RunnerEnv {
  rpcUrl: string;
  runnerPk: `0x${string}` | null;
  matchController: `0x${string}` | null;
  pitRouter: `0x${string}` | null;
  /** the v3 pool's own address — v3 pools are individually deployed contracts,
   *  there is no v4-style singleton PoolManager/PoolId to look one up in. */
  poolId: `0x${string}` | null;
  usdc: `0x${string}` | null;
  supabaseUrl: string;
  supabaseServiceKey: string;
}

function addr(v: string | undefined): `0x${string}` | null {
  return v && /^0x[0-9a-fA-F]{40}$/.test(v) ? (v as `0x${string}`) : null;
}

export function loadEnv(e: NodeJS.ProcessEnv = process.env): RunnerEnv {
  return {
    rpcUrl: e.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
    runnerPk:
      e.RUNNER_PRIVATE_KEY && e.RUNNER_PRIVATE_KEY.startsWith("0x")
        ? (e.RUNNER_PRIVATE_KEY as `0x${string}`)
        : null,
    matchController: addr(e.MATCH_CONTROLLER_ADDRESS),
    pitRouter: addr(e.PIT_ROUTER_ADDRESS),
    poolId: addr(e.POOL_ADDRESS),
    usdc: addr(e.USDC_ADDRESS),
    supabaseUrl: e.NEXT_PUBLIC_SUPABASE_URL ?? "",
    supabaseServiceKey: e.SUPABASE_SERVICE_KEY ?? "",
  };
}

export function requireChain(env: RunnerEnv): asserts env is RunnerEnv & {
  runnerPk: `0x${string}`;
  matchController: `0x${string}`;
} {
  const missing: string[] = [];
  if (!env.runnerPk) missing.push("RUNNER_PRIVATE_KEY");
  if (!env.matchController) missing.push("MATCH_CONTROLLER_ADDRESS");
  if (missing.length) {
    throw new Error(
      `runner: chain mode needs ${missing.join(", ")} in .env (Phase 2). ` +
        `Use \`pit-runner mock\` until Amalraj's contracts are deployed.`,
    );
  }
}
