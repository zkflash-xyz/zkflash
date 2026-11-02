import { test } from "node:test";
import assert from "node:assert/strict";
import { LIMITATIONS, canonical, checkReport, makeReport, outcomesHash, reportHash, reportMarkdown, type CircuitFacts, type Environment } from "./report.ts";
import type { CaseResult } from "./engine.ts";

const circuit: CircuitFacts = { id: "path_member", title: "Path member", provingSystem: "UltraHonk (EVM target)", noirVersion: "1.0.0-beta.22", circuitHash: "0xaa", vkHash: "0xbb", gates: 8797 };
const env: Environment = { label: "this browser and device", userAgent: "test", cores: 8, threads: 1, memoryGb: null };
const results = (ms = 10): CaseResult[] => [
  { scenarioId: "a.valid", circuit: "path_member", kind: "valid", label: "True", expected: "verified", actual: "verified", match: true, detail: null, stages: [{ stage: "proving", ms }], publicInputs: ["0x01"], proofBytes: 2, proof: "0xc0ff" },
  { scenarioId: "a.invalid", circuit: "path_member", kind: "invalid", label: "False", expected: "witness_rejected", actual: "witness_rejected", match: true, detail: "no", stages: [], publicInputs: [], proofBytes: null, proof: null },
];

test("canonical JSON sorts keys and drops undefined", () => {
  assert.equal(canonical({ b: 1, a: [{ d: undefined, c: "x" }] }), '{"a":[{"c":"x"}],"b":1}');
});

test("outcomes hash ignores timing and case order but sees a different result", () => {
  const a = outcomesHash(circuit, results(10));
  assert.equal(a, outcomesHash(circuit, results(99)));
  assert.equal(a, outcomesHash(circuit, results(10).reverse()));
  const changed = results();
  changed[1].actual = "verified";
  assert.notEqual(a, outcomesHash(circuit, changed));
  assert.notEqual(a, outcomesHash({ ...circuit, vkHash: "0xcc" }, results()));
});

test("report hash changes with timings, outcomes hash does not", () => {
  const at = new Date("2026-11-02T00:00:00Z");
  const a = makeReport(circuit, env, results(10), at);
  const b = makeReport(circuit, env, results(11), at);
  assert.notEqual(reportHash(a), reportHash(b));
  assert.equal(a.outcomesHash, b.outcomesHash);
  assert.equal(reportHash(a), reportHash(JSON.parse(JSON.stringify(a))));
});

test("a report carries its limitations, a summary and the valid proof", () => {
  const r = makeReport(circuit, env, results());
  assert.deepEqual(r.limitations, LIMITATIONS);
  assert.deepEqual(r.summary, { total: 2, passed: 2, failed: 0 });
  assert.equal(r.proof?.bytes, 2);
  assert.equal("proof" in r.cases[0], false);
});

test("checkReport accepts its own output and sees edits", () => {
  const r = makeReport(circuit, env, results());
  assert.equal(checkReport(JSON.parse(JSON.stringify(r))).ok, true);
  const edited = JSON.parse(JSON.stringify(r));
  edited.cases[1].actual = "verified";
  assert.equal(checkReport(edited).ok, false);
  const proof = JSON.parse(JSON.stringify(r));
  proof.proof.hex = "0xdead";
  assert.equal(checkReport(proof).ok, false);
  assert.equal(checkReport({ hello: 1 }).ok, false);
  assert.equal(checkReport(null).ok, false);
});

test("markdown names the hashes, the cases and every limitation", () => {
  const r = makeReport(circuit, env, results());
  const md = reportMarkdown(r, "0xhash");
  assert.match(md, /0xhash/);
  assert.match(md, /True/);
  for (const l of LIMITATIONS) assert.ok(md.includes(l));
});
