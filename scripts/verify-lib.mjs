// Checks behind scripts/verify-deployment.mjs, free of I/O so they can be tested with a fake chain.
//
// How it decides that an address runs this repository's contract:
//   - Runtime code is compared byte for byte with src/lib/contracts/artifacts.json
//     (`npm run contracts:artifacts -- --check` proves that file is a fresh forge build).
//     Only three kinds of bytes may differ, and each is then checked on its own:
//       * a library's PUSH20 self-address (must equal the address being checked),
//       * linked library addresses (each library is verified the same way),
//       * immutables, decoded by name and compared with their expected values.
//   - The creation transaction is required (no tx => FAIL, never MATCH). It must have succeeded, created exactly the
//     address checked, have no recipient, and its input must be exactly this build's creation code with the same
//     library links. Neither contract takes constructor arguments, so nothing may follow.
// Every check fails closed: an RPC error, an empty or malformed answer is a FAIL, never a skip.

export const CHAIN_ID = 4663;
export const LIBS = ["ZkflashSpongeTape", "ZkflashGateChecks"];

const isAddr = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v);
const isHex = (v) => typeof v === "string" && /^0x([0-9a-fA-F]{2})*$/.test(v);
const isTx = (v) => typeof v === "string" && /^0x[0-9a-fA-F]{64}$/.test(v);
const same = (a, b) => String(a).toLowerCase() === String(b).toLowerCase();
const slice = (hex, start, length) => hex.slice(2 + start * 2, 2 + (start + length) * 2);
export const put = (hex, ranges, bytes) => {
  let out = hex.slice(2);
  for (const r of ranges) out = out.slice(0, r.start * 2) + bytes(r) + out.slice((r.start + r.length) * 2);
  return `0x${out}`;
};

/** Exact structural match: { links, immutables } when `code` is this build's `name` apart from those, else null. */
export function match(ART, name, code, at) {
  const a = ART[name];
  code = String(code).toLowerCase();
  if (!a || code.length !== a.runtime.length) return null;
  if (LIBS.includes(name)) {
    // A deployed library begins with PUSH20 <its own address>; nothing else may differ.
    return code === `0x73${String(at).toLowerCase().slice(2)}${a.runtime.slice(44)}` ? { links: {}, immutables: {} } : null;
  }
  const links = {};
  for (const l of a.runtimeLinks) {
    const v = `0x${slice(code, l.start, l.length)}`;
    if (links[l.lib] && links[l.lib] !== v) return null;
    links[l.lib] = v;
  }
  const immutables = {};
  for (const r of a.immutables) {
    const v = slice(code, r.start, r.length);
    if (immutables[r.name] !== undefined && immutables[r.name] !== v) return null;
    immutables[r.name] = v;
  }
  const rebuilt = put(put(a.runtime, a.runtimeLinks, (r) => links[r.lib].slice(2)), a.immutables, (r) => immutables[r.name]);
  return rebuilt === code ? { links, immutables } : null;
}

/** input: { book?, bookTx?, verifier?, verifierTx?, rpc, ART, chainId? }. rpc(method, params) -> result (may throw). Returns { ok, lines }. */
export async function verifyDeployment({ book, bookTx, verifier, verifierTx, rpc, ART, chainId = CHAIN_ID }) {
  const lines = [];
  let failed = false;
  const ok = (m) => lines.push(`OK   ${m}`);
  const fail = (m) => {
    failed = true;
    lines.push(`FAIL ${m}`);
  };
  const done = () => ({ ok: !failed, lines });
  const seen = new Map();

  async function verify(name, at) {
    at = at.toLowerCase();
    if (seen.has(at)) return seen.get(at);
    let code;
    try {
      code = String((await rpc("eth_getCode", [at, "latest"])) || "0x").toLowerCase();
    } catch (e) {
      fail(`${name} at ${at}: eth_getCode failed (${e.message})`);
      return null;
    }
    if (!isHex(code) || code === "0x") {
      fail(`${name} at ${at}: no code`);
      return null;
    }
    const m = match(ART, name, code, at);
    seen.set(at, m);
    if (!m) {
      fail(`${name} at ${at}: runtime code differs from this build`);
      return null;
    }
    ok(`${name} at ${at}: runtime code is this build${LIBS.includes(name) ? " (only the self-address differs)" : ""}`);
    for (const [lib, address] of Object.entries(m.links)) {
      if ((await verify(lib, address)) === null) fail(`${name} links ${lib} at ${address}, which is not this build`);
    }
    for (const [key, want] of Object.entries(ART[name].expectedImmutables ?? {})) {
      const got = BigInt(`0x${m.immutables[key]}`).toString();
      if (got === want) ok(`${name}.${key} = ${got}`);
      else fail(`${name}.${key} = ${got}, expected ${want}`);
    }
    return m;
  }

  async function creation(name, at, tx) {
    // Runtime code alone cannot show who deployed it or with what input: without the creation tx the answer is never MATCH.
    if (!tx) return fail(`${name}: no creation tx given; runtime alone is not a full match`);
    if (!isTx(tx)) return fail(`${name}: the creation tx is not a 32-byte transaction hash`);
    try {
      const [t, rc] = await Promise.all([rpc("eth_getTransactionByHash", [tx]), rpc("eth_getTransactionReceipt", [tx])]);
      if (!t || !rc) return fail(`${name}: creation tx ${tx} not found`);
      if (rc.status !== "0x1") return fail(`${name}: creation tx failed`);
      if (!same(rc.contractAddress, at)) return fail(`${name}: tx created ${rc.contractAddress}, not ${at}`);
      if (t.to) return fail(`${name}: tx has a recipient, not a deployment`);
      const a = ART[name];
      const links = seen.get(at.toLowerCase())?.links ?? {};
      const want = put(a.creation, a.creationLinks, (r) => (links[r.lib] ?? `0x${"00".repeat(20)}`).slice(2));
      if (String(t.input).toLowerCase() === want) ok(`${name}: creation input is exactly this build (same links, no constructor arguments)`);
      else fail(`${name}: creation input differs from this build`);
    } catch (e) {
      fail(`${name}: creation tx unreadable: ${e.message}`);
    }
  }

  try {
    const id = await rpc("eth_chainId", []);
    if (Number(BigInt(id)) !== chainId) {
      fail(`chain id ${id}, expected ${chainId}`);
      return done();
    }
    ok(`chain id ${chainId}`);
  } catch (e) {
    fail(`chain id unreadable: ${e.message}`);
    return done();
  }
  if (!book && !verifier) {
    fail("give --book and/or --verifier");
    return done();
  }
  for (const [name, at, tx] of [
    ["ZkflashRunBook", book, bookTx],
    ["ZkflashPathCheck", verifier, verifierTx],
  ]) {
    if (!at) continue;
    if (!isAddr(at)) {
      fail(`${name}: not an address`);
      continue;
    }
    await verify(name, at);
    await creation(name, at, tx);
  }
  return done();
}
