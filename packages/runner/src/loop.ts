/**
 * Autonomous mode — keeps a real match running back-to-back forever, so the
 * frontend usually has something live to show instead of only being alive
 * for the few minutes right after someone manually kicks one off.
 *
 * Resilient by design: one match failing (a genuine on-chain revert, a
 * network blip) never kills the loop — it's logged and the loop moves on to
 * the next match after a cooldown.
 */
import { rehearse } from "./rehearsal.js";

const COOLDOWN_MS = 20_000;

export async function runLoop(): Promise<void> {
  let n = 0;
  let searchFrom = 1;
  console.log("\n########## THE PIT — autonomous match loop starting ##########\n");
  while (true) {
    n++;
    const startedAt = new Date().toISOString();
    console.log(`\n========== [loop ${n}] starting a match — ${startedAt} ==========\n`);
    try {
      const usedMatchId = await rehearse("chain", undefined, searchFrom);
      searchFrom = Number(usedMatchId) + 1;
      console.log(`\n[loop ${n}] match ${usedMatchId} complete.`);
    } catch (e) {
      console.error(`\n[loop ${n}] match failed: ${e instanceof Error ? e.message : e}`);
      // don't know which matchId this attempt burned (it may have registered
      // agents before failing) — advance the search floor defensively so the
      // next iteration doesn't collide with it.
      searchFrom += 1;
    }
    console.log(`[loop] cooling down ${COOLDOWN_MS / 1000}s before the next match...\n`);
    await new Promise((r) => setTimeout(r, COOLDOWN_MS));
  }
}
