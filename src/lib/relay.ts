import { toEventSelector } from "viem";
import { BRAND, ETH_USD_FEED, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";

/*
 * Rules for the read-only JSON-RPC relay, kept apart from the route so they can be tested. Every request is priced
 * in units; each network has a budget and the whole site has a ceiling. Only the exact request shapes the site
 * itself issues pass:
 *   - eth_call to the price feed, the token, the run book, or the proof verifier (verify() only, priced higher,
 *     because one proof check runs about 2.9M gas);
 *   - eth_estimateGas for the run book only;
 *   - eth_getLogs on the run book only, naming its events, with a block range cap.
 * It never forwards a signed transaction.
 */

export const MAX_CALLS = 20;
export const MAX_LOGS_PER_BATCH = 3;
export const MAX_LOG_SPAN = 20_000;
export const MAX_GAS = 3_000_000;
/** One proof check on the verifier: measured at about 2.92M gas, capped with room to spare. */
export const MAX_VERIFY_GAS = 8_000_000;
/** Largest verify() call in hex characters: selector, offsets, a 32 KB proof and a few inputs. */
export const MAX_VERIFY_DATA = 2 + 8 + 64 * 40 + 2 * 32_768;
export const MAX_CALL_DATA = 4_000;
/** Largest estimate: a proof check through the run book. */
export const MAX_ESTIMATE_DATA = MAX_VERIFY_DATA + 64;
export const MAX_BODY = 262_144;
export const BUDGET = { units: 2_000, windowSec: 600, siteUnits: 40_000 };
/** A verify() eth_call costs the upstream node far more than a view read. */
export const VERIFY_UNITS = 20;

/** verify(bytes,bytes32[]) */
export const VERIFY_SELECTOR = "0xea50d0e4";

const GAS_CAP_HEX = `0x${MAX_GAS.toString(16)}`;
const VERIFY_GAS_HEX = `0x${MAX_VERIFY_GAS.toString(16)}`;
const CALL_KEYS = new Set(["from", "to", "gas", "gasPrice", "maxFeePerGas", "maxPriorityFeePerGas", "value", "data", "input", "nonce", "type", "chainId"]);
const LOG_KEYS = new Set(["address", "fromBlock", "toBlock", "topics", "blockHash"]);
const BLOCK_TAG = /^(latest|pending|safe|finalized|0x[0-9a-fA-F]{1,16})$/;

/**
 * Normalises a call object before it is checked and forwarded. The node reads `input` as well as `data`, so `input`
 * is folded into `data` (refused when the two disagree) and every check sees the bytes that will run; a call without
 * `gas` gets the relay cap. Mutates `tx`; running it twice is harmless.
 */
function shapeTx(tx: Record<string, unknown>, cap: string): string | null {
  // The node decodes field names case-insensitively ("TO" would override "to"), so only these exact names pass.
  for (const k of Object.keys(tx)) if (!CALL_KEYS.has(k)) return `Unsupported call field: ${k.slice(0, 32)}`;
  if (tx.input !== undefined) {
    if (tx.data !== undefined && tx.data !== tx.input) return "data and input disagree.";
    tx.data = tx.input;
    delete tx.input;
  }
  if (tx.data !== undefined && (typeof tx.data !== "string" || !/^0x[0-9a-fA-F]*$/.test(tx.data))) return "Call data must be hex.";
  if (tx.value !== undefined && !(typeof tx.value === "string" && /^0x0*$/.test(tx.value))) return "Calls with value are not relayed.";
  if (tx.gas === undefined) tx.gas = cap;
  return null;
}

export const COST: Record<string, number> = {
  eth_getLogs: 10,
  eth_call: 2,
  eth_getTransactionReceipt: 1,
  eth_getTransactionByHash: 1,
  eth_blockNumber: 1,
  eth_getBalance: 1,
  eth_chainId: 1,
  eth_gasPrice: 1,
  eth_getBlockByNumber: 1,
  eth_getTransactionCount: 1,
  eth_maxPriorityFeePerGas: 1,
  eth_getCode: 1,
  eth_estimateGas: 3,
};

export type Targets = { book: string; verifier: string; reads: Set<string> };

export function readTargets(): Targets {
  const reads: string[] = [ETH_USD_FEED];
  if (isAddress(BRAND.ca)) reads.push(BRAND.ca);
  if (isAddress(CONTRACTS.book)) reads.push(CONTRACTS.book);
  return { book: CONTRACTS.book.toLowerCase(), verifier: CONTRACTS.verifier.toLowerCase(), reads: new Set(reads.map((a) => a.toLowerCase())) };
}

export const BOOK_TOPICS = [
  "WorkspaceCreated(uint64,address,string,bool)",
  "PolicyChanged(uint64,address,bool)",
  "MemberInvited(uint64,address,address,uint8)",
  "InviteCancelled(uint64,address,address)",
  "RoleChanged(uint64,address,address,uint8)",
  "CircuitRegistered(uint64,uint64,bytes32,uint32,bytes32,bytes32,address,string,string)",
  "CircuitStateChanged(uint64,address,uint8)",
  "ReportAnchored(uint64,uint64,address,bytes32,bytes32,bytes32,uint16,uint16,string)",
  "ReportAttested(uint64,address,uint8,bool,bytes32)",
  "ReportStateChanged(uint64,uint8)",
  "ProofChecked(uint64,address,address,bytes32)",
].map((s) => toEventSelector(s));

const TOPIC = /^0x[0-9a-f]{64}$/;
const asList = (v: unknown): unknown[] | null => (typeof v === "string" ? [v] : Array.isArray(v) ? v : null);

/** A log filter the site itself issues: the run book, its events, optionally one indexed value. */
export function checkLogShape(address: unknown, topics: unknown, book: string): string | null {
  if (!/^0x[0-9a-f]{40}$/.test(book)) return "eth_getLogs address not served by this relay.";
  const addrs = asList(address);
  if (!addrs || addrs.length !== 1 || typeof addrs[0] !== "string" || addrs[0].toLowerCase() !== book) return "eth_getLogs address not served by this relay.";
  if (!Array.isArray(topics) || topics.length < 1 || topics.length > 2) return "Log queries take topics [event] or [event, value].";
  const first = asList(topics[0]);
  if (!first || first.length < 1 || first.length > BOOK_TOPICS.length) return "Log queries must name run book events.";
  if (!first.every((t) => typeof t === "string" && BOOK_TOPICS.includes(t.toLowerCase() as `0x${string}`))) return "Log queries must name run book events.";
  if (topics.length === 2) {
    const v = asList(topics[1]);
    if (!v || v.length !== 1 || typeof v[0] !== "string" || !TOPIC.test(v[0].toLowerCase())) return "Log queries take one indexed value.";
  }
  return null;
}

export type Call = { jsonrpc?: string; id?: unknown; method: string; params?: unknown[] };

const hexBlock = (v: unknown) => (typeof v === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(v) ? Number(BigInt(v)) : null);
const gasOf = (g: unknown) => (typeof g === "string" && /^0x[0-9a-fA-F]{1,16}$/.test(g) ? Number(BigInt(g)) : Infinity);

/** Checks a batch and returns its cost in units, or the reason it is refused. */
export function checkBatch(calls: Call[], targets: Targets = readTargets()): { units: number } | { error: string } {
  if (calls.length === 0 || calls.length > MAX_CALLS) return { error: `Between 1 and ${MAX_CALLS} calls per request.` };
  let units = 0;
  let logs = 0;
  let verifies = 0;
  for (const c of calls) {
    if (!c || typeof c.method !== "string" || !Object.hasOwn(COST, c.method)) return { error: `Method not allowed: ${String(c?.method)}` };
    if (c.params !== undefined && !Array.isArray(c.params)) return { error: "params must be an array." };
    const params = c.params ?? [];
    units += COST[c.method];
    if (c.method === "eth_getLogs") {
      logs += 1;
      if (logs > MAX_LOGS_PER_BATCH) return { error: `At most ${MAX_LOGS_PER_BATCH} log queries per request.` };
      const filter = (params[0] ?? {}) as { address?: unknown; fromBlock?: unknown; toBlock?: unknown; blockHash?: unknown; topics?: unknown };
      if (typeof filter !== "object" || filter === null || Array.isArray(filter)) return { error: "eth_getLogs needs a filter object." };
      const oddKey = Object.keys(filter).find((k) => !LOG_KEYS.has(k));
      if (oddKey) return { error: `Unsupported filter field: ${oddKey.slice(0, 32)}` };
      if (filter.blockHash !== undefined) return { error: "blockHash filters are not relayed." };
      const shape = checkLogShape(filter.address, filter.topics, targets.book);
      if (shape) return { error: shape };
      // Both ends must be hex numbers: "latest" or a missing bound would let one request scan the whole chain.
      const from = hexBlock(filter.fromBlock);
      const to = hexBlock(filter.toBlock);
      if (from === null || to === null) return { error: "eth_getLogs needs numeric fromBlock and toBlock." };
      if (to < from) return { error: "toBlock is before fromBlock." };
      const width = to - from + 1;
      if (width > MAX_LOG_SPAN) return { error: "Log range too wide." };
      units += Math.ceil(width / 1_000);
    }
    if (c.method === "eth_call" || c.method === "eth_estimateGas") {
      if (params.length > 2) return { error: "State overrides are not relayed." };
      const tx = params[0] as { to?: unknown; gas?: unknown; data?: unknown; input?: unknown } | undefined;
      if (!tx || typeof tx !== "object" || typeof tx.to !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(tx.to)) return { error: `${c.method} needs a target address.` };
      const to = tx.to.toLowerCase();
      const raw = tx.data ?? tx.input;
      const isVerify = c.method === "eth_call" && /^0x[0-9a-f]{40}$/.test(targets.verifier) && to === targets.verifier;
      if (!isVerify && !targets.reads.has(to)) return { error: `${c.method} target not served by this relay.` };
      if (c.method === "eth_estimateGas" && to !== targets.book) return { error: "eth_estimateGas is relayed only for the run book." };
      const shaped = shapeTx(tx as Record<string, unknown>, isVerify || c.method === "eth_estimateGas" ? VERIFY_GAS_HEX : GAS_CAP_HEX);
      if (shaped) return { error: shaped };
      if (params[1] !== undefined && !(typeof params[1] === "string" && BLOCK_TAG.test(params[1]))) return { error: "Unsupported block tag." };
      const cap = isVerify || c.method === "eth_estimateGas" ? MAX_VERIFY_GAS : MAX_GAS;
      if (gasOf(tx.gas) > cap) return { error: "Gas above the relay cap." };
      const d = typeof tx.data === "string" ? tx.data : typeof raw === "string" ? raw : "0x";
      if (isVerify) {
        if (d.slice(0, 10).toLowerCase() !== VERIFY_SELECTOR) return { error: "Only verify() is relayed to the verifier." };
        if (d.length > MAX_VERIFY_DATA) return { error: "Call data too large." };
        verifies += 1;
        if (verifies > 1) return { error: "One proof check per request." };
        units += VERIFY_UNITS;
      } else if (d.length > (c.method === "eth_estimateGas" ? MAX_ESTIMATE_DATA : MAX_CALL_DATA)) return { error: "Call data too large." };
    }
    if (c.method === "eth_getBlockByNumber" && params[1] !== false) return { error: "eth_getBlockByNumber is relayed only with full transactions off (false)." };
  }
  return { units };
}

export type RpcAnswer = { result: unknown } | { error: { code: number; message: string; data?: string } } | { down: true };

export type RelayDeps = {
  /** Charges the caller's budgets; returns the refusal message, or null when allowed. */
  charge: (units: number) => Promise<string | null>;
  one: (method: string, params: unknown[]) => Promise<RpcAnswer>;
  many: (calls: { method: string; params: unknown[] }[]) => Promise<(unknown | null)[]>;
};

/** The relay's whole decision, without I/O of its own. A refused request never reaches the RPC. */
export async function runRelay(body: Call | Call[], deps: RelayDeps, targets: Targets = readTargets()): Promise<{ status: number; body: unknown }> {
  const calls = Array.isArray(body) ? body : [body];
  const checked = checkBatch(calls, targets);
  if ("error" in checked) {
    // A refused request still costs one unit, so probing has a price.
    await deps.charge(1);
    return { status: 400, body: { error: checked.error } };
  }
  const refused = await deps.charge(checked.units);
  if (refused) return { status: 429, body: { error: refused } };
  if (calls.length === 1 && !Array.isArray(body)) {
    const c = calls[0];
    const a = await deps.one(c.method, c.params ?? []);
    if ("down" in a) return { status: 502, body: { error: "The chain could not be reached." } };
    return { status: 200, body: { jsonrpc: "2.0", id: c.id ?? null, ...a } };
  }
  try {
    const results = await deps.many(calls.map((c) => ({ method: c.method, params: c.params ?? [] })));
    const out = calls.map((c, i) => (results[i] === null ? { jsonrpc: "2.0", id: c.id ?? null, error: { code: -32000, message: "read failed" } } : { jsonrpc: "2.0", id: c.id ?? null, result: results[i] }));
    return { status: 200, body: Array.isArray(body) ? out : out[0] };
  } catch {
    return { status: 502, body: { error: "The chain could not be reached." } };
  }
}
