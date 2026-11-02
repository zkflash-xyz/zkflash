/*
 * Test scenarios: an input set, what to do to the result, and which outcome is expected.
 * Four kinds:
 *   valid                  true statement, the proof must verify
 *   invalid                false statement, the circuit must refuse to produce a witness
 *   tampered_public_input  valid proof, one public input changed afterwards, verification must fail
 *   tampered_proof_byte    valid proof, one byte flipped afterwards, verification must fail
 */
import { CIRCUIT_IDS, CIRCUITS, type CircuitId, type Values } from "./core.ts";

export type ScenarioKind = "valid" | "invalid" | "tampered_public_input" | "tampered_proof_byte";
export type Outcome = "verified" | "witness_rejected" | "verification_rejected";

export const KIND_LABEL: Record<ScenarioKind, string> = {
  valid: "Valid",
  invalid: "Invalid",
  tampered_public_input: "Tampered input",
  tampered_proof_byte: "Tampered proof",
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  verified: "Verified",
  witness_rejected: "Witness rejected",
  verification_rejected: "Verification rejected",
};

export const expectedFor = (kind: ScenarioKind): Outcome => (kind === "valid" ? "verified" : kind === "invalid" ? "witness_rejected" : "verification_rejected");

export type Scenario = {
  id: string;
  circuit: CircuitId;
  kind: ScenarioKind;
  label: string;
  values: Values;
  expected: Outcome;
  /** Which public input to change (tampered_public_input). */
  publicIndex?: number;
  /** Which proof byte to flip, as a fraction of the proof (tampered_proof_byte). */
  byteAt?: number;
};

const INVALID: Record<CircuitId, { label: string; values: Values }[]> = {
  hash_opening: [{ label: "Digest belongs to other values", values: { left: "1729", right: "4105", digest: "0x1" } }],
  range_gate: [
    { label: "Value above the upper bound", values: { value: "70", salt: "90210", low: "18", high: "65" } },
    { label: "Commitment to another value", values: { value: "42", salt: "90210", low: "18", high: "65", commitment: "12345" } },
  ],
  path_member: [
    { label: "Root the leaf is not under", values: { secret: "271828", scope: "2026", index: "3", root: "777" } },
    { label: "Tag from another scope", values: { secret: "271828", scope: "2026", index: "3", tag: "888" } },
  ],
  tally_floor: [{ label: "Total under the floor", values: { counts: "3,1,4,1,5,9,2,6", salt: "161803", floor: "32" } }],
};

function forCircuit(circuit: CircuitId): Scenario[] {
  const base = CIRCUITS[circuit].defaults;
  return [
    { id: `${circuit}.valid`, circuit, kind: "valid", label: "True statement", values: base, expected: "verified" },
    ...INVALID[circuit].map((s, i) => ({ id: `${circuit}.invalid.${i + 1}`, circuit, kind: "invalid" as const, label: s.label, values: s.values, expected: "witness_rejected" as const })),
    { id: `${circuit}.public`, circuit, kind: "tampered_public_input", label: `${CIRCUITS[circuit].publicNames[0]} changed after proving`, values: base, publicIndex: 0, expected: "verification_rejected" },
    { id: `${circuit}.byte`, circuit, kind: "tampered_proof_byte", label: "One proof byte flipped", values: base, byteAt: 0.5, expected: "verification_rejected" },
  ];
}

export const SCENARIOS: Scenario[] = CIRCUIT_IDS.flatMap(forCircuit);

export const scenariosOf = (circuit: CircuitId) => SCENARIOS.filter((s) => s.circuit === circuit);
