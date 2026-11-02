import manifest from "./manifest.json";
import { CIRCUITS, CIRCUIT_IDS, type CircuitId } from "./core";
import type { CircuitFacts } from "./report";

/* Facts measured from the circuit artifacts by scripts/zk-manifest.mts. */
export type CircuitManifest = (typeof manifest)[CircuitId];

export const MANIFEST = manifest as Record<CircuitId, CircuitManifest>;
export const isCircuitId = (v: string | null | undefined): v is CircuitId => CIRCUIT_IDS.includes(v as CircuitId);

export function circuitFacts(id: CircuitId): CircuitFacts {
  const m = MANIFEST[id];
  return { id, title: CIRCUITS[id].title, provingSystem: m.provingSystem, noirVersion: m.noirVersion, circuitHash: m.circuitHash, vkHash: m.vkHash, gates: m.gates };
}
