// Writes src/lib/zk/manifest.json (facts about each bundled circuit, measured from the artifacts) and
// contracts/test/fixtures/path_member.json (a real proof for the Solidity tests).
// Run after circuits/build.sh: npm run zk:manifest
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { keccak256, toHex } from "viem";
import { CIRCUIT_IDS, CIRCUITS } from "../src/lib/zk/core.ts";
import { scenariosOf } from "../src/lib/zk/scenarios.ts";
import { runScenario } from "../src/lib/zk/engine.ts";
import { nodeBackend } from "../src/lib/zk/backend-node.ts";

const log = console.log;
console.log = () => {}; // bb.js logs progress on stdout.
const url = (p: string) => new URL(`../${p}`, import.meta.url);
const backend = nodeBackend();
const out: Record<string, unknown> = {};
for (const id of CIRCUIT_IDS) {
  const raw = readFileSync(url(`public/zk/${id}.json`));
  const art = JSON.parse(raw.toString());
  const vkFile = readFileSync(url(`public/zk/${id}.vk`));
  const vk = await backend.vk(id);
  if (toHex(vk) !== toHex(new Uint8Array(vkFile))) throw new Error(`${id}: the verification key from bb.js differs from the bb command line`);
  const target = url(`circuits/${id}/target/${id}.json`);
  let gates: number | null = null;
  let opcodes: number | null = null;
  if (existsSync(target)) {
    const bb = process.env.BB || `${homedir()}/.bb/bb`;
    const g = JSON.parse(execFileSync(bb, ["gates", "-b", fileURLToPath(target)], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
    gates = g.functions[0].circuit_size;
    opcodes = g.functions[0].acir_opcodes;
  }
  const valid = scenariosOf(id).find((s) => s.kind === "valid")!;
  const run = await runScenario(valid, backend, () => performance.now());
  if (run.actual !== "verified") throw new Error(`${id}: the valid scenario did not verify`);
  out[id] = {
    id,
    title: CIRCUITS[id].title,
    provingSystem: "UltraHonk (EVM target)",
    noirVersion: art.noir_version.split("+")[0],
    circuitHash: keccak256(toHex(new Uint8Array(Buffer.from(art.bytecode, "base64")))),
    vkHash: keccak256(toHex(vk)),
    gates,
    opcodes,
    publicInputs: run.publicInputs.length,
    proofBytes: run.proofBytes,
    vkBytes: vk.length,
    artifactBytes: raw.length,
  };
  if (id === "path_member") writeFileSync(url("contracts/test/fixtures/path_member.json"), JSON.stringify({ proof: run.proof, publicInputs: run.publicInputs }));
  log(id, JSON.stringify(out[id]));
}
await backend.close();
writeFileSync(url("src/lib/zk/manifest.json"), `${JSON.stringify(out, null, 2)}\n`);
process.exit(0);
