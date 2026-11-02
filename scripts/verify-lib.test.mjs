// verify-lib against a fake chain built from this build's artifacts: a true deployment matches, and
// a foreign runtime, a wrong chain, appended arguments or a creation tx for another address each fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { match, put, verifyDeployment } from "./verify-lib.mjs";

const ART = JSON.parse(readFileSync(new URL("../src/lib/contracts/artifacts.json", import.meta.url), "utf8")).contracts;
const A = (n) => "0x" + n.toString(16).padStart(40, "0");
const BOOK = A(0xb00c);
const CHECK = A(0xc4ec);
const TX = "0x" + "01".repeat(32);
const TX2 = "0x" + "02".repeat(32);

const TAPE = A(0x7a9e);
const GATE = A(0x6a7e);
const links = { ZkflashSpongeTape: TAPE, ZkflashGateChecks: GATE };

/** The verifier as a chain holds it: links set, immutables filled with what the source fixes. */
function linked(name = "ZkflashPathCheck", immutable) {
  const a = ART[name];
  const withLinks = put(a.runtime, a.runtimeLinks, (r) => links[r.lib].slice(2));
  return put(withLinks, a.immutables, (r) => immutable ?? BigInt(a.expectedImmutables[r.name]).toString(16).padStart(r.length * 2, "0"));
}
const lib = (name, at) => `0x73${at.slice(2)}${ART[name].runtime.slice(44)}`;
const creation = () => put(ART.ZkflashPathCheck.creation, ART.ZkflashPathCheck.creationLinks, (r) => links[r.lib].slice(2));

function chain(over = {}) {
  const codes = { [BOOK]: ART.ZkflashRunBook.runtime, [CHECK]: linked(), [TAPE]: lib("ZkflashSpongeTape", TAPE), [GATE]: lib("ZkflashGateChecks", GATE), ...over.codes };
  const txs = {
    [TX]: { input: over.input ?? ART.ZkflashRunBook.creation, to: over.to ?? null, created: over.created ?? BOOK },
    [TX2]: { input: over.verifierInput ?? creation(), to: null, created: CHECK },
  };
  return async (method, params) => {
    if (over.throwOn === method) throw new Error("rpc down");
    if (method === "eth_chainId") return over.chainId ?? "0x1237";
    if (method === "eth_getCode") return codes[params[0].toLowerCase()] ?? "0x";
    if (method === "eth_getTransactionByHash") return txs[params[0]] ? { input: txs[params[0]].input, to: txs[params[0]].to } : null;
    if (method === "eth_getTransactionReceipt") return txs[params[0]] ? { status: over.status ?? "0x1", contractAddress: txs[params[0]].created } : null;
    throw new Error(`unexpected ${method}`);
  };
}

const args = { book: BOOK, bookTx: TX, verifier: CHECK, verifierTx: TX2, ART };

test("a true deployment of both contracts matches", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain() });
  assert.equal(r.ok, true, r.lines.join("\n"));
});

test("the verifier links two libraries and its immutables are checked by value", async () => {
  assert.ok(ART.ZkflashPathCheck.immutables.length > 0);
  assert.equal(ART.ZkflashRunBook.immutables.length, 0);
  assert.deepEqual(Object.keys(match(ART, "ZkflashPathCheck", linked(), CHECK).links).sort(), ["ZkflashGateChecks", "ZkflashSpongeTape"]);
  const bad = await verifyDeployment({ ...args, rpc: chain({ codes: { [CHECK]: linked("ZkflashPathCheck", "ab".repeat(32)) } }) });
  assert.equal(bad.ok, false);
});

test("a library swapped for other code fails", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ codes: { [TAPE]: lib("ZkflashSpongeTape", A(0x1)) } }) });
  assert.equal(r.ok, false);
});

test("a verifier linking a missing library fails", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ codes: { [GATE]: "0x" } }) });
  assert.equal(r.ok, false);
});

test("creation input with other links fails", async () => {
  const other = put(ART.ZkflashPathCheck.creation, ART.ZkflashPathCheck.creationLinks, () => "11".repeat(20));
  const r = await verifyDeployment({ ...args, rpc: chain({ verifierInput: other }) });
  assert.equal(r.ok, false);
});

test("foreign runtime code fails", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ codes: { [BOOK]: "0x6080604052" } }) });
  assert.equal(r.ok, false);
});

test("no code fails", async () => {
  const r = await verifyDeployment({ ...args, book: A(0x1), rpc: chain() });
  assert.equal(r.ok, false);
});

test("a wrong chain stops at once", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ chainId: "0x1" }) });
  assert.equal(r.ok, false);
  assert.equal(r.lines.length, 1);
});

test("no creation tx is never a match", async () => {
  const r = await verifyDeployment({ ...args, bookTx: undefined, rpc: chain() });
  assert.equal(r.ok, false);
  assert.ok(r.lines.some((l) => l.includes("no creation tx")));
});

test("appended bytes in the creation input fail", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ input: `${ART.ZkflashRunBook.creation}00` }) });
  assert.equal(r.ok, false);
});

test("a creation tx for another address fails", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ created: A(0x9) }) });
  assert.equal(r.ok, false);
});

test("a reverted creation tx fails", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ status: "0x0" }) });
  assert.equal(r.ok, false);
});

test("an RPC failure is a FAIL, never a skip", async () => {
  const r = await verifyDeployment({ ...args, rpc: chain({ throwOn: "eth_getCode" }) });
  assert.equal(r.ok, false);
});

test("nothing to check is a FAIL", async () => {
  const r = await verifyDeployment({ ART, rpc: chain() });
  assert.equal(r.ok, false);
});
