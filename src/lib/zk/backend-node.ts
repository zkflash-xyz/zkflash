/*
 * Node backend for tests and tools. Uses the same circuit artifacts as the browser (public/zk/*.json).
 */
import { readFileSync } from "node:fs";
import { Noir } from "@noir-lang/noir_js";
import { Barretenberg, UltraHonkBackend } from "@aztec/bb.js";
import type { Backend } from "./engine.ts";

const artifact = (id: string) => JSON.parse(readFileSync(new URL(`../../../public/zk/${id}.json`, import.meta.url), "utf8"));

export function nodeBackend(threads = 4): Backend & { close(): Promise<void>; vk(circuit: string): Promise<Uint8Array> } {
  let api: Promise<Barretenberg> | null = null;
  const made = new Map<string, { noir: Noir; honk: UltraHonkBackend }>();
  const get = async (id: string) => {
    api ??= Barretenberg.new({ threads });
    let entry = made.get(id);
    if (!entry) {
      const circuit = artifact(id);
      entry = { noir: new Noir(circuit), honk: new UltraHonkBackend(circuit.bytecode, await api) };
      made.set(id, entry);
    }
    return entry;
  };
  return {
    prepare: async (id) => void (await get(id)),
    execute: async (id, witness) => (await (await get(id)).noir.execute(witness)).witness,
    prove: async (id, solved) => (await get(id)).honk.generateProof(solved, { verifierTarget: "evm" }),
    verify: async (id, proof, publicInputs) => (await get(id)).honk.verifyProof({ proof, publicInputs }, { verifierTarget: "evm" }),
    vk: async (id) => (await get(id)).honk.getVerificationKey({ verifierTarget: "evm" }),
    close: async () => {
      if (api) await (await api).destroy();
      api = null;
      made.clear();
    },
  };
}
