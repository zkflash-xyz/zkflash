/*
 * Browser prover, run as a dedicated web worker (bundled by scripts/build-prover.mjs into public/zk/prover.js).
 * Solves witnesses with noir_js and proves with Barretenberg (UltraHonk, EVM target) in WASM on one thread. Every file
 * it needs is served by this site: the circuits, the WASM binaries and the public SRS points (Aztec Ignition ceremony,
 * first 2^17 points). Inputs never leave this worker.
 */
import { Noir } from "@noir-lang/noir_js";
import initACVM from "@noir-lang/acvm_js";
import initNoirC from "@noir-lang/noirc_abi";
import { Barretenberg, BackendType, UltraHonkBackend } from "@aztec/bb.js";
import { fromHex, runScenario, toHex, type Backend } from "./engine.ts";
import type { Scenario } from "./scenarios.ts";

type Request = { id: number; kind: "warm" } | { id: number; kind: "run"; scenario: Scenario } | { id: number; kind: "verify"; circuit: string; proof: string; publicInputs: string[] } | { id: number; kind: "vk"; circuit: string };

const BASE = new URL("./", self.location.href).href;
const SRS_POINTS = 131_072; // bb accepts compressed points in 4 MiB blocks (2^17 points); these circuits need 2^14.

async function bytes(path: string) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

let core: Promise<Barretenberg> | null = null;
function api() {
  core ??= (async () => {
    await Promise.all([initACVM({ module_or_path: fetch(BASE + "acvm_js_bg.wasm") }), initNoirC({ module_or_path: fetch(BASE + "noirc_abi_wasm_bg.wasm") })]);
    const bb = await Barretenberg.new({ backend: BackendType.Wasm, threads: 1, wasmPath: BASE + "barretenberg.wasm.gz", skipSrsInit: true });
    const [g1, g2] = await Promise.all([bytes("crs/bn254_g1_compressed.dat"), bytes("crs/bn254_g2.dat")]);
    await bb.srsInitSrs({ pointsBuf: g1, numPoints: SRS_POINTS, g2Point: g2 });
    return bb;
  })();
  core.catch(() => {
    core = null;
  });
  return core;
}

const loaded = new Map<string, Promise<{ noir: Noir; honk: UltraHonkBackend }>>();
function circuit(id: string) {
  if (!/^[a-z_]+$/.test(id)) throw new Error("Unknown circuit.");
  let entry = loaded.get(id);
  if (!entry) {
    entry = (async () => {
      const bb = await api();
      const res = await fetch(`${BASE}${id}.json`);
      if (!res.ok) throw new Error(`Could not load the circuit (${res.status})`);
      const art = await res.json();
      return { noir: new Noir(art), honk: new UltraHonkBackend(art.bytecode, bb) };
    })();
    loaded.set(id, entry);
    entry.catch(() => loaded.delete(id));
  }
  return entry;
}

const backend: Backend = {
  prepare: async (id) => void (await circuit(id)),
  execute: async (id, witness) => (await (await circuit(id)).noir.execute(witness)).witness,
  prove: async (id, solved) => (await circuit(id)).honk.generateProof(solved, { verifierTarget: "evm" }),
  verify: async (id, proof, publicInputs) => (await circuit(id)).honk.verifyProof({ proof, publicInputs }, { verifierTarget: "evm" }),
};

self.onmessage = async (event: MessageEvent<Request>) => {
  const msg = event.data;
  try {
    if (msg.kind === "warm") {
      await api();
      self.postMessage({ id: msg.id, ok: true });
    } else if (msg.kind === "run") {
      const result = await runScenario(msg.scenario, backend, () => performance.now(), (stage) => self.postMessage({ id: msg.id, progress: stage }));
      self.postMessage({ id: msg.id, ok: true, result });
    } else if (msg.kind === "verify") {
      const started = performance.now();
      let valid = false;
      let detail: string | null = null;
      try {
        valid = await backend.verify(msg.circuit, fromHex(msg.proof), msg.publicInputs);
      } catch (error) {
        detail = error instanceof Error ? error.message.split("\n")[0].slice(0, 200) : String(error);
      }
      self.postMessage({ id: msg.id, ok: true, valid, detail, ms: performance.now() - started });
    } else {
      const vk = await (await circuit(msg.circuit)).honk.getVerificationKey({ verifierTarget: "evm" });
      self.postMessage({ id: msg.id, ok: true, vk: toHex(vk) });
    }
  } catch (error) {
    self.postMessage({ id: msg.id, ok: false, error: error instanceof Error ? error.message : String(error) });
  }
};
