/*
 * Verification reports. A report is plain JSON with a stable key order, so anyone can recompute its hash.
 *   outcomesHash  covers what must come out the same on another machine: circuit, cases, expected and actual results.
 *   reportHash    covers the whole report, timings, environment and proof included. It changes on every run,
 *                 because proofs are randomised and clocks differ.
 */
import { keccak256, stringToHex } from "viem";
import type { CaseResult } from "./engine.ts";

export const REPORT_SCHEMA = "zkflash.report/1";

export const LIMITATIONS = [
  "Timings were measured once on the machine named in this report. They are not a benchmark and do not predict other devices.",
  "A verified proof shows only the statement written in the circuit. It says nothing about whether the inputs are true in the world.",
  "Outcomes are self-reported by whoever produced this report. An anchored hash proves when this text was published, not that it is correct.",
  "A second wallet attesting 'reproduced' may belong to the same person.",
  "Bundled circuits were not reviewed by an outside party. Do not reuse them for anything that protects value.",
];

export type CircuitFacts = { id: string; title: string; provingSystem: string; noirVersion: string; circuitHash: string; vkHash: string; gates: number | null };
export type Environment = { label: string; userAgent: string; cores: number | null; threads: number; memoryGb: number | null };

export type ReportCase = Omit<CaseResult, "proof">;

export type Report = {
  schema: string;
  createdAt: string;
  circuit: CircuitFacts;
  environment: Environment;
  cases: ReportCase[];
  summary: { total: number; passed: number; failed: number };
  /** The proof of the first valid case, so it can be checked again. Null when no valid case produced one. */
  proof: { hex: string; hash: string; bytes: number; publicInputs: string[] } | null;
  outcomesHash: string;
  limitations: string[];
};

/** JSON with sorted keys. Same value, same text. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

export const hashText = (text: string) => keccak256(stringToHex(text));

/** The deterministic part of a run. Two machines that see the same behaviour get the same hash. */
export function outcomesHash(circuit: Pick<CircuitFacts, "id" | "circuitHash" | "vkHash">, cases: Pick<CaseResult, "scenarioId" | "kind" | "expected" | "actual">[]): string {
  const rows = cases.map((c) => ({ scenarioId: c.scenarioId, kind: c.kind, expected: c.expected, actual: c.actual })).sort((a, b) => (a.scenarioId < b.scenarioId ? -1 : a.scenarioId > b.scenarioId ? 1 : 0));
  return hashText(canonical({ schema: REPORT_SCHEMA, circuit: { id: circuit.id, circuitHash: circuit.circuitHash, vkHash: circuit.vkHash }, cases: rows }));
}

function withoutProof(r: CaseResult): ReportCase {
  const copy: Partial<CaseResult> = { ...r };
  delete copy.proof;
  return copy as ReportCase;
}

export function makeReport(circuit: CircuitFacts, environment: Environment, results: CaseResult[], createdAt: Date = new Date()): Report {
  const valid = results.find((r) => r.kind === "valid" && r.actual === "verified" && r.proof);
  const passed = results.filter((r) => r.match).length;
  return {
    schema: REPORT_SCHEMA,
    createdAt: createdAt.toISOString(),
    circuit,
    environment,
    cases: results.map(withoutProof),
    summary: { total: results.length, passed, failed: results.length - passed },
    proof: valid?.proof ? { hex: valid.proof, hash: keccak256(valid.proof as `0x${string}`), bytes: (valid.proof.length - 2) / 2, publicInputs: valid.publicInputs } : null,
    outcomesHash: outcomesHash(circuit, results),
    limitations: LIMITATIONS,
  };
}

export const reportHash = (report: Report) => hashText(canonical(report));

export type ReportCheck = { ok: boolean; problems: string[]; reportHash: string | null; outcomesHash: string | null };

/** Checks an uploaded report on its own terms: shape, recomputed outcomes hash, summary and proof hash. */
export function checkReport(raw: unknown): ReportCheck {
  const problems: string[] = [];
  const r = raw as Partial<Report> | null;
  if (!r || typeof r !== "object" || r.schema !== REPORT_SCHEMA || !r.circuit || !Array.isArray(r.cases)) return { ok: false, problems: ["This is not a zkFlash report."], reportHash: null, outcomesHash: null };
  const again = outcomesHash(r.circuit, r.cases);
  if (again !== r.outcomesHash) problems.push("The outcomes hash does not match the cases in the file.");
  const passed = r.cases.filter((c) => c.expected === c.actual).length;
  if (r.summary?.passed !== passed || r.summary?.total !== r.cases.length) problems.push("The summary does not match the cases in the file.");
  if (r.proof && keccak256(r.proof.hex as `0x${string}`) !== r.proof.hash) problems.push("The proof hash does not match the proof in the file.");
  return { ok: problems.length === 0, problems, reportHash: reportHash(r as Report), outcomesHash: again };
}

const ms = (v: number | undefined) => (v === undefined ? "—" : `${v.toFixed(0)} ms`);

export function reportMarkdown(r: Report, hash: string): string {
  const stage = (c: ReportCase, s: string) => ms(c.stages.find((x) => x.stage === s)?.ms);
  return [
    `# zkFlash verification report`,
    ``,
    `- Circuit: ${r.circuit.title} (${r.circuit.id})`,
    `- Proving system: ${r.circuit.provingSystem}, Noir ${r.circuit.noirVersion}`,
    `- Circuit hash: \`${r.circuit.circuitHash}\``,
    `- Verification key hash: \`${r.circuit.vkHash}\``,
    `- Created: ${r.createdAt}`,
    `- Report hash: \`${hash}\``,
    `- Outcomes hash: \`${r.outcomesHash}\``,
    `- Result: ${r.summary.passed} of ${r.summary.total} cases matched what was expected`,
    ``,
    `## Environment`,
    ``,
    `Measured in: ${r.environment.label}. Cores reported: ${r.environment.cores ?? "—"}. Prover threads: ${r.environment.threads}.`,
    ``,
    `\`${r.environment.userAgent}\``,
    ``,
    `## Cases`,
    ``,
    `| Case | Kind | Expected | Actual | Match | Witness | Proving | Verification |`,
    `|---|---|---|---|---|---|---|---|`,
    ...r.cases.map((c) => `| ${c.label} | ${c.kind} | ${c.expected} | ${c.actual} | ${c.match ? "yes" : "NO"} | ${stage(c, "witness")} | ${stage(c, "proving")} | ${stage(c, "verification")} |`),
    ``,
    `## Proof`,
    ``,
    r.proof ? `${r.proof.bytes} bytes, keccak256 \`${r.proof.hash}\`. Public inputs: ${r.proof.publicInputs.map((p) => `\`${p}\``).join(", ")}.` : `No proof in this report.`,
    ``,
    `## Limitations`,
    ``,
    ...r.limitations.map((l) => `- ${l}`),
    ``,
  ].join("\n");
}
