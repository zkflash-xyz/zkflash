/*
 * The four bundled circuits, seen from outside the prover: what each one states, which values it takes and how
 * those values become a witness. Free of WASM so the same code runs in the worker, in Node and in tests.
 * The Poseidon instance is the circomlib-compatible BN254 one, the same as the circuits use (vectors in core.test.ts).
 */
import { poseidon1, poseidon2 } from "poseidon-lite";

export const FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617n;

export type CircuitId = "hash_opening" | "range_gate" | "path_member" | "tally_floor";
export const CIRCUIT_IDS: CircuitId[] = ["hash_opening", "range_gate", "path_member", "tally_floor"];

/** Plain text values from a form or a scenario. Empty optional fields are derived from the others. */
export type Values = Record<string, string>;
export type FieldDef = { key: string; label: string; hint: string; secret: boolean; optional?: boolean };

export type CircuitInfo = {
  id: CircuitId;
  title: string;
  /** Short tag for lists. */
  kind: string;
  statement: string;
  reveals: string;
  hides: string;
  doesNotProve: string;
  fields: FieldDef[];
  publicNames: string[];
  /** The one circuit with a Solidity verifier. */
  onChain: boolean;
  defaults: Values;
};

export const CIRCUITS: Record<CircuitId, CircuitInfo> = {
  hash_opening: {
    id: "hash_opening",
    title: "Hash opening",
    kind: "Preimage",
    statement: "The prover knows two field elements whose Poseidon hash equals the public digest.",
    reveals: "The digest.",
    hides: "The two values, as long as they are hard to guess.",
    doesNotProve: "Who the prover is, or where the digest came from.",
    fields: [
      { key: "left", label: "Left value", hint: "Field element, decimal or 0x hex", secret: true },
      { key: "right", label: "Right value", hint: "Field element, decimal or 0x hex", secret: true },
      { key: "digest", label: "Digest override", hint: "Leave empty to compute it", secret: false, optional: true },
    ],
    publicNames: ["digest"],
    onChain: false,
    defaults: { left: "1729", right: "4104" },
  },
  range_gate: {
    id: "range_gate",
    title: "Range gate",
    kind: "Bounds",
    statement: "The value behind a public commitment lies inside the public bounds.",
    reveals: "The commitment and both bounds.",
    hides: "The value and the salt.",
    doesNotProve: "That the value is true in the world. The prover chose it.",
    fields: [
      { key: "value", label: "Value", hint: "Integer, 64 bits", secret: true },
      { key: "salt", label: "Salt", hint: "Field element, keep it random", secret: true },
      { key: "low", label: "Lower bound", hint: "Integer, 64 bits", secret: false },
      { key: "high", label: "Upper bound", hint: "Integer, 64 bits", secret: false },
      { key: "commitment", label: "Commitment override", hint: "Leave empty to compute it", secret: false, optional: true },
    ],
    publicNames: ["commitment", "low", "high"],
    onChain: false,
    defaults: { value: "42", salt: "90210", low: "18", high: "65" },
  },
  path_member: {
    id: "path_member",
    title: "Path member",
    kind: "Merkle",
    statement: "A leaf derived from a private secret sits under the public root, and the public tag came from the same secret and the public scope.",
    reveals: "The root, the scope and the tag. The same secret and scope always give the same tag.",
    hides: "The secret and the position in the tree.",
    doesNotProve: "That the wallet sending a transaction is the holder of the secret. Address, IP and timing stay visible.",
    fields: [
      { key: "secret", label: "Secret", hint: "Field element", secret: true },
      { key: "scope", label: "Scope", hint: "Field element, public", secret: false },
      { key: "index", label: "Leaf position", hint: "0 to 7 in the sample tree", secret: true },
      { key: "root", label: "Root override", hint: "Leave empty to compute it", secret: false, optional: true },
      { key: "tag", label: "Tag override", hint: "Leave empty to compute it", secret: false, optional: true },
    ],
    publicNames: ["root", "scope", "tag"],
    onChain: true,
    defaults: { secret: "271828", scope: "2026", index: "3" },
  },
  tally_floor: {
    id: "tally_floor",
    title: "Tally floor",
    kind: "Sum",
    statement: "Eight private counts behind a public commitment add up to at least the public floor.",
    reveals: "The commitment and the floor.",
    hides: "Each count and the exact total.",
    doesNotProve: "That the counts were measured honestly. The prover supplied them.",
    fields: [
      { key: "counts", label: "Eight counts", hint: "Comma separated, 32 bits each", secret: true },
      { key: "salt", label: "Salt", hint: "Field element, keep it random", secret: true },
      { key: "floor", label: "Floor", hint: "Integer, 64 bits", secret: false },
      { key: "commitment", label: "Commitment override", hint: "Leave empty to compute it", secret: false, optional: true },
    ],
    publicNames: ["commitment", "floor"],
    onChain: false,
    defaults: { counts: "3,1,4,1,5,9,2,6", salt: "161803", floor: "30" },
  },
};

export class InputError extends Error {}

/** Parses a decimal or 0x hex field element. Reduces nothing: values at or over the modulus are refused. */
export function parseField(raw: string | undefined, label: string): bigint {
  const text = (raw ?? "").trim();
  if (!/^(0x[0-9a-fA-F]+|[0-9]+)$/.test(text)) throw new InputError(`${label} must be a decimal or 0x hex number.`);
  const value = BigInt(text);
  if (value >= FIELD) throw new InputError(`${label} is outside the field.`);
  return value;
}

export const toHex32 = (v: bigint) => `0x${v.toString(16).padStart(64, "0")}`;

export const hash1 = (a: bigint) => poseidon1([a]);
export const hash2 = (a: bigint, b: bigint) => poseidon2([a, b]);

export const TREE_DEPTH = 8;
export const SAMPLE_LEAVES = 8;

/** Sample neighbours for the demo tree: eight leaves, the rest empty. */
export function sampleLeaf(i: number): bigint {
  return hash1(BigInt(1000 + i));
}

/** Root and path of a leaf at `index` in the sample tree (zero-padded to depth 8). */
export function samplePath(leaf: bigint, index: number): { root: bigint; siblings: bigint[]; bits: bigint[] } {
  if (!Number.isInteger(index) || index < 0 || index >= SAMPLE_LEAVES) throw new InputError(`Leaf position must be 0 to ${SAMPLE_LEAVES - 1}.`);
  let level = Array.from({ length: SAMPLE_LEAVES }, (_, i) => (i === index ? leaf : sampleLeaf(i)));
  let at = index;
  const siblings: bigint[] = [];
  const bits: bigint[] = [];
  for (let d = 0; d < TREE_DEPTH; d++) {
    siblings.push(level[at ^ 1] ?? 0n);
    bits.push(BigInt(at & 1));
    const next: bigint[] = [];
    for (let i = 0; i < level.length; i += 2) next.push(hash2(level[i], level[i + 1] ?? 0n));
    level = next;
    at >>= 1;
  }
  return { root: level[0], siblings, bits };
}

const parseUint = (raw: string | undefined, label: string, bits: number): bigint => {
  const v = parseField(raw, label);
  if (v >= 1n << BigInt(bits)) throw new InputError(`${label} must fit in ${bits} bits.`);
  return v;
};

const override = (raw: string | undefined, computed: bigint, label: string) => ((raw ?? "").trim() ? parseField(raw, label) : computed);

export type Built = {
  /** Witness in the shape the compiled circuit's ABI expects. */
  witness: Record<string, string | string[]>;
  /** Public inputs in circuit order, as 32-byte hex. */
  publicInputs: string[];
};

/** Turns form values into a witness. Refuses malformed input; a false statement still builds and fails in the circuit. */
export function buildWitness(id: CircuitId, values: Values): Built {
  const dec = (v: bigint) => v.toString();
  switch (id) {
    case "hash_opening": {
      const left = parseField(values.left, "Left value");
      const right = parseField(values.right, "Right value");
      const digest = override(values.digest, hash2(left, right), "Digest");
      return { witness: { digest: dec(digest), left: dec(left), right: dec(right) }, publicInputs: [toHex32(digest)] };
    }
    case "range_gate": {
      const value = parseUint(values.value, "Value", 64);
      const salt = parseField(values.salt, "Salt");
      const low = parseUint(values.low, "Lower bound", 64);
      const high = parseUint(values.high, "Upper bound", 64);
      const commitment = override(values.commitment, hash2(value, salt), "Commitment");
      return { witness: { commitment: dec(commitment), low: dec(low), high: dec(high), value: dec(value), salt: dec(salt) }, publicInputs: [commitment, low, high].map(toHex32) };
    }
    case "path_member": {
      const secret = parseField(values.secret, "Secret");
      const scope = parseField(values.scope, "Scope");
      const index = Number(parseField(values.index, "Leaf position"));
      const path = samplePath(hash1(secret), index);
      const root = override(values.root, path.root, "Root");
      const tag = override(values.tag, hash2(secret, scope), "Tag");
      return {
        witness: { root: dec(root), scope: dec(scope), tag: dec(tag), secret: dec(secret), siblings: path.siblings.map(dec), bits: path.bits.map(dec) },
        publicInputs: [root, scope, tag].map(toHex32),
      };
    }
    case "tally_floor": {
      const parts = (values.counts ?? "").split(",").map((s) => s.trim());
      if (parts.length !== 8) throw new InputError("Eight counts are needed, comma separated.");
      const counts = parts.map((p, i) => parseUint(p, `Count ${i + 1}`, 32));
      const salt = parseField(values.salt, "Salt");
      const floor = parseUint(values.floor, "Floor", 64);
      const commitment = override(values.commitment, counts.reduce((acc, c) => hash2(acc, c), salt), "Commitment");
      return { witness: { commitment: dec(commitment), floor: dec(floor), counts: counts.map(dec), salt: dec(salt) }, publicInputs: [commitment, floor].map(toHex32) };
    }
  }
}
