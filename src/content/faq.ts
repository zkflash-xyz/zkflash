import { BRAND } from "@/config/brand";

/* Plain questions, shown as text on /docs and repeated in its structured data. */
export const FAQ = [
  { q: `What is ${BRAND.name}?`, a: `${BRAND.name} is a zero-knowledge proof testing and verification studio. It generates real proofs from four bundled Noir circuits in your browser, runs valid, invalid and tampered test cases against them, measures each stage on your own device, and exports reports with their limits written down.` },
  { q: `How does ${BRAND.name} work?`, a: `A Web Worker in your browser loads a compiled circuit and the proving WASM from this site. It solves the witness, generates an UltraHonk proof and verifies it. Results go to a log in your browser. A report can be exported, and its hash anchored on the run book contract.` },
  { q: `Which network is ${BRAND.name} on?`, a: `Robinhood Chain, chain id 4663. Proving and local verification need no network at all once the files are loaded. Only the on-chain verifier check and the run book use the chain.` },
  { q: `How do I buy ${BRAND.symbol}?`, a: `${BRAND.symbol} launches on Pons on Robinhood Chain. The only real address is the one on this site and on ${BRAND.xHandle}. Nothing in the studio needs the token, and it carries no promised value. This is not financial advice.` },
  { q: `Do my inputs leave the browser?`, a: `No. Private inputs stay in the worker and are not written into reports. Public inputs and the proof go into the exported file. Only hashes and case counts go on chain, and only when you anchor.` },
  { q: `Are the timings a benchmark?`, a: `No. Each number is one measurement on the browser and device that made it, with one prover thread. Other machines, other tabs and even your next run will differ.` },
  { q: `What are the risks?`, a: `The bundled circuits are test material that no outside party has reviewed, so do not use them to protect value. A verified proof shows only the statement in the circuit, not that the inputs are true. Contracts can have bugs, and transactions cost gas and cannot be undone. An attestation can come from a second wallet held by the same person.` },
];
