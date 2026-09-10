#!/usr/bin/env node
/**
 * pit-runner <command>
 *
 *   mock       Phase 1 — publish + step the mock match to Supabase (no chain)
 *   rehearse   Phase 5 — full 3-agent rehearsal. `--chain` for on-chain mode.
 *   run        Phase 2+ — run one real match on Base Sepolia (needs .env)
 *   loop       Autonomous — run real matches back-to-back forever
 */
import { driveMock } from "./mockDriver.js";
import { rehearse } from "./rehearsal.js";
import { runLoop } from "./loop.js";

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const chain = rest.includes("--chain");

  switch (cmd) {
    case "mock":
      await driveMock();
      break;
    case "rehearse":
      await rehearse(chain ? "chain" : "mock");
      break;
    case "run":
      // no explicit matchId -> rehearse() auto-picks the next unused one on-chain
      await rehearse("chain", rest.find((a) => !a.startsWith("--")));
      break;
    case "loop":
      await runLoop();
      break;
    default:
      console.log("usage: pit-runner <mock|rehearse|run|loop> [--chain] [matchId]");
      process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
