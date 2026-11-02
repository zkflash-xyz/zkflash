// Runs every bundled scenario with real proofs in Node and prints expected against actual.
// Run: npx tsx scripts/zk-selftest.mts
import { SCENARIOS } from "../src/lib/zk/scenarios.ts";
import { runScenario } from "../src/lib/zk/engine.ts";
import { nodeBackend } from "../src/lib/zk/backend-node.ts";

const log = console.log;
console.log = () => {}; // bb.js logs progress on stdout.
const backend = nodeBackend();
let bad = 0;
for (const s of SCENARIOS) {
  const r = await runScenario(s, backend, () => performance.now());
  if (!r.match) bad++;
  log(`${r.match ? "ok  " : "FAIL"} ${s.id.padEnd(30)} expected ${s.expected.padEnd(22)} actual ${r.actual.padEnd(22)} ${r.stages.map((x) => `${x.stage[0]}${x.ms.toFixed(0)}`).join(" ")} ${r.detail ?? ""}`);
}
await backend.close();
log(`${SCENARIOS.length - bad} of ${SCENARIOS.length} scenarios matched`);
process.exit(bad ? 1 : 0);
