// Every bundled scenario with real proofs: nothing here is mocked.
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { SCENARIOS } from "./scenarios.ts";
import { runScenario } from "./engine.ts";
import { nodeBackend } from "./backend-node.ts";
import { makeReport, checkReport } from "./report.ts";
import manifest from "./manifest.json" with { type: "json" };

const log = console.log;
const backend = nodeBackend();
after(async () => {
  await backend.close();
  console.log = log;
});

for (const s of SCENARIOS) {
  test(`${s.id}: expected ${s.expected}`, async () => {
    console.log = () => {}; // bb.js logs progress on stdout.
    const r = await runScenario(s, backend, () => performance.now());
    console.log = log;
    assert.equal(r.actual, s.expected, r.detail ?? "");
    assert.ok(r.stages.every((x) => x.ms >= 0));
    if (s.kind === "invalid") assert.equal(r.proof, null);
    else assert.ok(r.proof && r.proofBytes === manifest[s.circuit].proofBytes);
  });
}

test("a report from real results passes its own check", async () => {
  console.log = () => {};
  const results = [];
  for (const s of SCENARIOS.filter((x) => x.circuit === "hash_opening")) results.push(await runScenario(s, backend, () => performance.now()));
  console.log = log;
  const m = manifest.hash_opening;
  const report = makeReport({ id: m.id, title: m.title, provingSystem: m.provingSystem, noirVersion: m.noirVersion, circuitHash: m.circuitHash, vkHash: m.vkHash, gates: m.gates }, { label: "node", userAgent: "test", cores: null, threads: 4, memoryGb: null }, results);
  assert.equal(report.summary.failed, 0);
  assert.equal(checkReport(JSON.parse(JSON.stringify(report))).ok, true);
});
