import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, keccak256, toBytes } from "viem";
import { BOOK_TOPICS, MAX_LOG_SPAN, MAX_VERIFY_DATA, VERIFY_SELECTOR, checkBatch, checkLogShape, runRelay, type Targets } from "./relay.ts";
import { VERIFIER_ABI } from "./abi.ts";

const BOOK = "0x" + "b0".repeat(20);
const VERIFIER = "0x" + "ce".repeat(20);
const FEED = "0x78f3556b67e17df817d51ef5a990cdaf09e8d3a9";
const T: Targets = { book: BOOK, verifier: VERIFIER, reads: new Set([FEED, BOOK]) };
const logs = (over: object = {}) => ({ method: "eth_getLogs", params: [{ address: BOOK, fromBlock: "0x1", toBlock: "0x10", topics: [BOOK_TOPICS[0]], ...over }] });
const err = (r: { units: number } | { error: string }) => ("error" in r ? r.error : null);

test("the selector constant is verify(bytes,bytes32[])", () => {
  assert.equal(keccak256(toBytes("verify(bytes,bytes32[])")).slice(0, 10), VERIFY_SELECTOR);
  assert.equal(encodeFunctionData({ abi: VERIFIER_ABI, functionName: "verify", args: ["0x00", []] }).slice(0, 10), VERIFY_SELECTOR);
});

test("unknown methods are refused, including object prototype names", () => {
  assert.match(err(checkBatch([{ method: "eth_sendRawTransaction", params: [] }], T))!, /not allowed/);
  assert.match(err(checkBatch([{ method: "constructor", params: [] }], T))!, /not allowed/);
  assert.match(err(checkBatch([{ method: "toString", params: [] }], T))!, /not allowed/);
});

test("batches have a size limit", () => {
  assert.ok(err(checkBatch([], T)));
  assert.ok(err(checkBatch(Array.from({ length: 21 }, () => ({ method: "eth_chainId" })), T)));
});

test("eth_call only reaches known targets", () => {
  assert.equal(err(checkBatch([{ method: "eth_call", params: [{ to: FEED, data: "0xfeaf968c" }, "latest"] }], T)), null);
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: "0x" + "11".repeat(20), data: "0x" }, "latest"] }], T))!, /not served/);
});

test("verify only reaches the verifier, costs more and has a higher gas cap", () => {
  const ok = checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR + "00".repeat(100) }, "latest"] }], T);
  assert.ok("units" in ok && ok.units >= 20);
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, data: "0x12345678" }, "latest"] }], T))!, /Only verify/);
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR, gas: "0x7a12000" }, "latest"] }], T))!, /Gas/);
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR + "0".repeat(MAX_VERIFY_DATA) }, "latest"] }], T))!, /too large/);
  const two = { method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR }, "latest"] };
  assert.match(err(checkBatch([two, { method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR }, "latest"] }], T))!, /One proof check/);
});

test("the input field cannot smuggle other bytes past the check", () => {
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR, input: "0x12345678" }, "latest"] }], T))!, /disagree/);
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, input: "0x12345678" }, "latest"] }], T))!, /Only verify/);
});

test("odd call fields and state overrides are refused", () => {
  assert.ok(err(checkBatch([{ method: "eth_call", params: [{ to: FEED, TO: VERIFIER, data: "0x" }, "latest"] }], T)));
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: FEED, data: "0x" }, "latest", {}] }], T))!, /overrides/);
  assert.match(err(checkBatch([{ method: "eth_call", params: [{ to: FEED, data: "0x", value: "0x1" }, "latest"] }], T))!, /value/);
});

test("a read gets a gas cap when it names none", () => {
  const tx: Record<string, string> = { to: FEED, data: "0x" };
  checkBatch([{ method: "eth_call", params: [tx, "latest"] }], T);
  assert.equal(tx.gas, "0x2dc6c0");
});

test("estimates are for the run book only", () => {
  assert.equal(err(checkBatch([{ method: "eth_estimateGas", params: [{ to: BOOK, data: "0x" }] }], T)), null);
  assert.match(err(checkBatch([{ method: "eth_estimateGas", params: [{ to: FEED, data: "0x" }] }], T))!, /only for the run book/);
  assert.ok(err(checkBatch([{ method: "eth_estimateGas", params: [{ to: VERIFIER, data: VERIFY_SELECTOR }] }], T)));
});

test("log filters must be the exact shapes the site issues", () => {
  assert.equal(err(checkBatch([logs()], T)), null);
  assert.equal(checkLogShape(BOOK, [BOOK_TOPICS[0], "0x" + "00".repeat(31) + "01"], BOOK), null);
  assert.ok(err(checkBatch([logs({ address: FEED })], T)));
  assert.ok(err(checkBatch([logs({ topics: [] })], T)));
  assert.ok(err(checkBatch([logs({ topics: ["0x" + "12".repeat(32)] })], T)));
  assert.ok(err(checkBatch([logs({ topics: [BOOK_TOPICS[0], "0x" + "00".repeat(32), "0x" + "00".repeat(32)] })], T)));
  assert.ok(err(checkBatch([logs({ fromBlock: "latest" })], T)));
  assert.ok(err(checkBatch([logs({ toBlock: undefined })], T)));
  assert.ok(err(checkBatch([logs({ fromBlock: "0x10", toBlock: "0x1" })], T)));
  assert.ok(err(checkBatch([logs({ fromBlock: "0x1", toBlock: `0x${(MAX_LOG_SPAN + 2).toString(16)}` })], T)));
  assert.ok(err(checkBatch([logs({ blockHash: "0x" + "00".repeat(32) })], T)));
  assert.ok(err(checkBatch([logs({ other: 1 })], T)));
  assert.ok(err(checkBatch([logs(), logs(), logs(), logs()], T)));
});

test("logs are refused before the book is deployed", () => {
  const empty: Targets = { book: "", verifier: "", reads: new Set([FEED]) };
  assert.ok(err(checkBatch([logs()], empty)));
  assert.ok(err(checkBatch([{ method: "eth_call", params: [{ to: VERIFIER, data: VERIFY_SELECTOR }, "latest"] }], empty)));
});

test("full blocks are refused", () => {
  assert.ok(err(checkBatch([{ method: "eth_getBlockByNumber", params: ["latest", true] }], T)));
  assert.equal(err(checkBatch([{ method: "eth_getBlockByNumber", params: ["latest", false] }], T)), null);
});

test("a refused request never reaches the RPC and is still charged", async () => {
  let charged = 0;
  let reached = 0;
  const deps = { charge: async (u: number) => ((charged += u), null), one: async () => ((reached++, { result: "0x1" })), many: async () => ((reached++, [])) };
  const r = await runRelay({ method: "eth_sendRawTransaction", params: ["0x"] }, deps, T);
  assert.equal(r.status, 400);
  assert.equal(reached, 0);
  assert.equal(charged, 1);
});

test("over budget answers 429 without reaching the RPC", async () => {
  let reached = 0;
  const r = await runRelay({ method: "eth_chainId" }, { charge: async () => "slow down", one: async () => ((reached++, { result: "0x1" })), many: async () => [] }, T);
  assert.equal(r.status, 429);
  assert.equal(reached, 0);
});

test("a single call and a batch both answer in JSON-RPC shape", async () => {
  const deps = { charge: async () => null, one: async () => ({ result: "0x1237" }), many: async () => ["0x1", null] };
  const one = await runRelay({ id: 7, method: "eth_chainId" }, deps, T);
  assert.deepEqual(one.body, { jsonrpc: "2.0", id: 7, result: "0x1237" });
  const many = await runRelay([{ id: 1, method: "eth_chainId" }, { id: 2, method: "eth_gasPrice" }], deps, T);
  assert.equal((many.body as { result?: string }[])[0].result, "0x1");
  assert.ok((many.body as { error?: unknown }[])[1].error);
});

