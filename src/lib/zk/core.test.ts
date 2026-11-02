import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWitness, CIRCUIT_IDS, CIRCUITS, FIELD, hash1, hash2, InputError, parseField, samplePath, toHex32, TREE_DEPTH } from "./core.ts";
import { SCENARIOS, expectedFor, scenariosOf } from "./scenarios.ts";
import { bumpPublic, flipByte, fromHex, toHex } from "./engine.ts";

test("Poseidon matches the vectors pinned in the Noir tests", () => {
  assert.equal(toHex32(hash2(1n, 2n)), "0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a");
  assert.equal(toHex32(hash1(1n)), "0x29176100eaa962bdc1fe6c654d6a3c130e96a4d1168b33848b897dc502820133");
});

test("parseField takes decimal and hex, and refuses the rest", () => {
  assert.equal(parseField("17", "x"), 17n);
  assert.equal(parseField("0x11", "x"), 17n);
  for (const bad of ["", "abc", "-1", "1.5", "0x", "1e5", FIELD.toString()]) assert.throws(() => parseField(bad, "x"), InputError, bad);
});

test("default values of every circuit build a witness with the right public input count", () => {
  for (const id of CIRCUIT_IDS) {
    const built = buildWitness(id, CIRCUITS[id].defaults);
    assert.equal(built.publicInputs.length, CIRCUITS[id].publicNames.length, id);
    for (const p of built.publicInputs) assert.match(p, /^0x[0-9a-f]{64}$/);
  }
});

test("overrides replace the computed public value", () => {
  const b = buildWitness("hash_opening", { left: "1", right: "2", digest: "0x5" });
  assert.equal(b.publicInputs[0], toHex32(5n));
});

test("the sample tree path climbs back to the root", () => {
  for (let index = 0; index < 8; index++) {
    const leaf = hash1(99n);
    const { root, siblings, bits } = samplePath(leaf, index);
    assert.equal(siblings.length, TREE_DEPTH);
    let node = leaf;
    for (let d = 0; d < TREE_DEPTH; d++) node = bits[d] === 1n ? hash2(siblings[d], node) : hash2(node, siblings[d]);
    assert.equal(node, root);
  }
  assert.throws(() => samplePath(1n, 8), InputError);
});

test("malformed input is refused before the circuit", () => {
  assert.throws(() => buildWitness("range_gate", { value: "1", salt: "1", low: "x", high: "2" }), InputError);
  assert.throws(() => buildWitness("range_gate", { value: (1n << 64n).toString(), salt: "1", low: "0", high: "2" }), InputError);
  assert.throws(() => buildWitness("tally_floor", { counts: "1,2", salt: "1", floor: "1" }), InputError);
  assert.throws(() => buildWitness("path_member", { secret: "1", scope: "1", index: "9" }), InputError);
});

test("every circuit has all four kinds of scenario, with the expected outcome of its kind", () => {
  for (const id of CIRCUIT_IDS) {
    const kinds = new Set(scenariosOf(id).map((s) => s.kind));
    assert.deepEqual([...kinds].sort(), ["invalid", "tampered_proof_byte", "tampered_public_input", "valid"]);
  }
  for (const s of SCENARIOS) assert.equal(s.expected, expectedFor(s.kind), s.id);
  assert.equal(new Set(SCENARIOS.map((s) => s.id)).size, SCENARIOS.length);
});

test("only path_member claims an on-chain verifier", () => {
  assert.deepEqual(CIRCUIT_IDS.filter((id) => CIRCUITS[id].onChain), ["path_member"]);
});

test("tampering changes exactly one thing", () => {
  const proof = new Uint8Array(100).fill(7);
  const flipped = flipByte(proof, 0.5);
  assert.equal(flipped.filter((v, i) => v !== proof[i]).length, 1);
  assert.equal(flipByte(proof, 5).filter((v, i) => v !== proof[i]).length, 1);
  const inputs = [toHex32(1n), toHex32(2n)];
  assert.deepEqual(bumpPublic(inputs, 1), [toHex32(1n), toHex32(3n)]);
  assert.deepEqual(bumpPublic([toHex32(FIELD - 1n)], 0), [toHex32(0n)]);
});

test("hex helpers round trip and refuse junk", () => {
  assert.deepEqual([...fromHex(toHex(Uint8Array.from([0, 15, 255])))], [0, 15, 255]);
  assert.throws(() => fromHex("0xzz"));
  assert.throws(() => fromHex("0xabc"));
});
