import { test } from "node:test";
import assert from "node:assert/strict";
import { BookError, EMPTY_PRACTICE, practiceApply, practiceView, toCall, ZERO_ADDRESS, ZERO_HASH, type Action, type PracticeState } from "./book.ts";

const A = "0x" + "a".repeat(40);
const B = "0x" + "b".repeat(40);
const C = "0x" + "c".repeat(40);
const OUT = "0x" + "11".repeat(32);
const REP = "0x" + "22".repeat(32);
const PROOF = "0x" + "33".repeat(32);

const run = (s: PracticeState, a: Action, from = A) => practiceApply(s, a, from, 100);
const fails = (fn: () => unknown, code: string) => assert.throws(fn, (e: unknown) => e instanceof BookError && e.code === code, code);

function ready() {
  let s = run(EMPTY_PRACTICE, { kind: "createWorkspace", name: "Lab", reviewersOnly: false });
  s = run(s, { kind: "registerCircuit", workspaceId: 1, name: "path_member", circuitHash: OUT, vkHash: OUT, verifier: "", uri: "" });
  return s;
}
const anchor = (s: PracticeState) => run(s, { kind: "anchorReport", circuitId: 1, reportHash: REP, outcomesHash: OUT, proofHash: PROOF, passed: 4, failed: 0, uri: "" });

test("workspace names follow the contract's rule", () => {
  for (const name of ["", " a", "a ", "x".repeat(33), "a\nb", "café"]) fails(() => run(EMPTY_PRACTICE, { kind: "createWorkspace", name, reviewersOnly: false }), "NameInvalid");
  assert.equal(run(EMPTY_PRACTICE, { kind: "createWorkspace", name: "a b", reviewersOnly: false }).workspaces.length, 1);
});

test("invites do nothing until accepted, and leads are never zero", () => {
  let s = ready();
  fails(() => run(s, { kind: "invite", workspaceId: 1, who: B, role: 2 }, B), "NotALead");
  s = run(s, { kind: "invite", workspaceId: 1, who: B, role: 1 });
  assert.equal(practiceView(s, B).workspaces[0].myRole, 0);
  assert.equal(practiceView(s, B).workspaces[0].myInvite, 1);
  fails(() => run(s, { kind: "removeMember", workspaceId: 1, who: A }), "LastLead");
  s = run(s, { kind: "acceptInvite", workspaceId: 1 }, B);
  assert.equal(s.workspaces[0].leads, 2);
  s = run(s, { kind: "removeMember", workspaceId: 1, who: A });
  assert.equal(s.workspaces[0].leads, 1);
  fails(() => run(s, { kind: "changeRole", workspaceId: 1, who: B, role: 2 }, B), "LastLead");
});

test("a new circuit version supersedes the previous one", () => {
  let s = ready();
  s = run(s, { kind: "registerCircuit", workspaceId: 1, name: "path_member", circuitHash: REP, vkHash: OUT, verifier: "", uri: "" });
  assert.equal(s.circuits[0].state, 2);
  assert.equal(s.circuits[1].version, 2);
  fails(() => anchor(s), "CircuitNotActive");
});

test("only leads and runners anchor; a hash anchors once", () => {
  const s = ready();
  fails(() => run(s, { kind: "anchorReport", circuitId: 1, reportHash: REP, outcomesHash: OUT, proofHash: "", passed: 1, failed: 0, uri: "" }, B), "NotARunner");
  fails(() => run(s, { kind: "anchorReport", circuitId: 1, reportHash: REP, outcomesHash: OUT, proofHash: "", passed: 0, failed: 0, uri: "" }), "CaseCountInvalid");
  fails(() => anchor(anchor(s)), "ReportAlreadyAnchored");
});

test("attesting follows the state machine", () => {
  let s = anchor(ready());
  fails(() => run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }), "AuthorCannotAttest");
  fails(() => run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: REP }, B), "OutcomesDiffer");
  fails(() => run(s, { kind: "attest", reportId: 1, verdict: 2, resultHash: OUT }, B), "VerdictInvalid");
  s = run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }, B);
  assert.equal(s.reports[0].state, 2);
  fails(() => run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }, B), "AlreadyAttested");
  s = run(s, { kind: "attest", reportId: 1, verdict: 2, resultHash: REP }, C);
  assert.equal(s.reports[0].state, 3);
  assert.equal(practiceView(s, C).reports[0].myVerdict, 2);
});

test("reviewers-only workspaces refuse other wallets", () => {
  let s = anchor(ready());
  s = run(s, { kind: "setReviewersOnly", workspaceId: 1, reviewersOnly: true });
  fails(() => run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }, B), "NotAllowedToAttest");
  s = run(s, { kind: "invite", workspaceId: 1, who: B, role: 3 });
  s = run(s, { kind: "acceptInvite", workspaceId: 1 }, B);
  s = run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }, B);
  assert.equal(s.reports[0].reviewerReproduced, 1);
});

test("withdraw only before attestations, by the author", () => {
  let s = anchor(ready());
  fails(() => run(s, { kind: "withdrawReport", reportId: 1 }, B), "NotReportAuthor");
  const attested = run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }, B);
  fails(() => run(attested, { kind: "withdrawReport", reportId: 1 }), "ReportHasAttestations");
  s = run(s, { kind: "withdrawReport", reportId: 1 });
  assert.equal(s.reports[0].state, 4);
  fails(() => run(s, { kind: "attest", reportId: 1, verdict: 1, resultHash: OUT }, B), "ReportNotOpen");
  fails(() => anchor(s), "ReportAlreadyAnchored");
});

test("the input state is never changed", () => {
  const s = ready();
  const copy = JSON.stringify(s);
  anchor(s);
  assert.equal(JSON.stringify(s), copy);
});

test("actions map to the contract's functions", () => {
  assert.deepEqual(toCall({ kind: "registerCircuit", workspaceId: 1, name: "c", circuitHash: OUT, vkHash: OUT, verifier: "", uri: "" }).args, [1n, "c", OUT, OUT, ZERO_ADDRESS, ""]);
  assert.deepEqual(toCall({ kind: "anchorReport", circuitId: 2, reportHash: REP, outcomesHash: OUT, proofHash: "", passed: 1, failed: 2, uri: "" }).args, [2n, REP, OUT, ZERO_HASH, 1, 2, ""]);
  assert.equal(toCall({ kind: "attest", reportId: 3, verdict: 1, resultHash: OUT }).fn, "attest");
});
