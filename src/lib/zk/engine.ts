/*
 * Runs one scenario against a prover backend and measures each stage with the clock of the machine it runs on.
 * The same code runs in the browser worker and in Node, so tests exercise exactly what the site does.
 * Nothing here is mocked: a witness is solved, a proof is generated and a verifier checks it.
 */
import { buildWitness, FIELD, InputError, toHex32 } from "./core.ts";
import type { Outcome, Scenario, ScenarioKind } from "./scenarios.ts";

export type StageName = "preparation" | "witness" | "proving" | "verification";
export type StageTime = { stage: StageName; ms: number };

export type Backend = {
  /** Loads what the circuit needs. Called in the preparation stage. */
  prepare(circuit: string): Promise<void>;
  execute(circuit: string, witness: Record<string, string | string[]>): Promise<Uint8Array>;
  prove(circuit: string, solved: Uint8Array): Promise<{ proof: Uint8Array; publicInputs: string[] }>;
  verify(circuit: string, proof: Uint8Array, publicInputs: string[]): Promise<boolean>;
};

export type CaseResult = {
  scenarioId: string;
  circuit: string;
  kind: ScenarioKind;
  label: string;
  expected: Outcome;
  actual: Outcome;
  match: boolean;
  /** Why the witness or the verifier refused, when it did. */
  detail: string | null;
  stages: StageTime[];
  /** Public inputs as verified, after any tampering. */
  publicInputs: string[];
  proofBytes: number | null;
  /** Hex proof as it reached the verifier, after any tampering. */
  proof: string | null;
};

export const toHex = (b: Uint8Array) => `0x${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
export const fromHex = (h: string) => {
  const s = h.replace(/^0x/, "");
  if (s.length % 2 || !/^[0-9a-fA-F]*$/.test(s)) throw new InputError("Not valid hex.");
  return Uint8Array.from(s.match(/.{2}/g) ?? [], (x) => parseInt(x, 16));
};

const firstLine = (e: unknown) => (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 200);

/** Flips the lowest bit of one byte. `at` is a fraction of the proof length. */
export function flipByte(proof: Uint8Array, at: number): Uint8Array {
  const out = proof.slice();
  const i = Math.min(out.length - 1, Math.max(0, Math.floor(out.length * at)));
  out[i] ^= 1;
  return out;
}

/** Adds one to a public input, staying inside the field. */
export function bumpPublic(inputs: string[], index: number): string[] {
  const i = Math.min(inputs.length - 1, Math.max(0, index));
  return inputs.map((v, k) => (k === i ? toHex32((BigInt(v) + 1n) % FIELD) : v));
}

export type Clock = () => number;

export async function runScenario(scenario: Scenario, backend: Backend, now: Clock, onStage?: (s: StageTime) => void): Promise<CaseResult> {
  const stages: StageTime[] = [];
  const timed = async <T>(stage: StageName, work: () => Promise<T>): Promise<T> => {
    const t = now();
    try {
      return await work();
    } finally {
      const entry = { stage, ms: now() - t };
      stages.push(entry);
      onStage?.(entry);
    }
  };
  const finish = (actual: Outcome, detail: string | null, publicInputs: string[], proof: Uint8Array | null): CaseResult => ({
    scenarioId: scenario.id,
    circuit: scenario.circuit,
    kind: scenario.kind,
    label: scenario.label,
    expected: scenario.expected,
    actual,
    match: actual === scenario.expected,
    detail,
    stages,
    publicInputs,
    proofBytes: proof ? proof.length : null,
    proof: proof ? toHex(proof) : null,
  });

  const built = await timed("preparation", async () => {
    await backend.prepare(scenario.circuit);
    return buildWitness(scenario.circuit, scenario.values);
  });

  let solved: Uint8Array;
  try {
    solved = await timed("witness", () => backend.execute(scenario.circuit, built.witness));
  } catch (error) {
    return finish("witness_rejected", firstLine(error), built.publicInputs, null);
  }

  const { proof, publicInputs } = await timed("proving", () => backend.prove(scenario.circuit, solved));

  let usedProof = proof;
  let usedInputs = publicInputs;
  if (scenario.kind === "tampered_public_input") usedInputs = bumpPublic(publicInputs, scenario.publicIndex ?? 0);
  if (scenario.kind === "tampered_proof_byte") usedProof = flipByte(proof, scenario.byteAt ?? 0.5);

  let ok = false;
  let detail: string | null = null;
  try {
    ok = await timed("verification", () => backend.verify(scenario.circuit, usedProof, usedInputs));
  } catch (error) {
    detail = firstLine(error);
  }
  return finish(ok ? "verified" : "verification_rejected", detail, usedInputs, usedProof);
}
