"use client";

/* The main-thread side of the prover worker: one worker, one job at a time, in the order asked. */
import type { CaseResult, StageTime } from "./engine";
import type { Scenario } from "./scenarios";

type Waiting = { ok: (v: never) => void; fail: (e: Error) => void; onStage?: (s: StageTime) => void };

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, Waiting>();
let tail: Promise<unknown> = Promise.resolve();

function prover() {
  if (worker) return worker;
  worker = new Worker("/zk/prover.js", { type: "module" });
  worker.onmessage = (event) => {
    const { id, ok, error, progress, ...rest } = event.data;
    const w = waiting.get(id);
    if (!w) return;
    if (progress) {
      w.onStage?.(progress);
      return;
    }
    waiting.delete(id);
    if (ok) w.ok(rest as never);
    else w.fail(new Error(error ?? "The prover failed."));
  };
  worker.onerror = (event) => {
    event.preventDefault();
    for (const w of waiting.values()) w.fail(new Error("The prover stopped. Reload the page and try again."));
    waiting.clear();
    worker?.terminate();
    worker = null;
  };
  return worker;
}

function ask<T>(msg: Record<string, unknown>, onStage?: (s: StageTime) => void): Promise<T> {
  const job = tail.then(
    () =>
      new Promise<T>((ok, fail) => {
        const id = nextId++;
        waiting.set(id, { ok: ok as (v: never) => void, fail, onStage });
        prover().postMessage({ id, ...msg });
      }),
  );
  tail = job.catch(() => {});
  return job;
}

export const runInWorker = (scenario: Scenario, onStage?: (s: StageTime) => void) => ask<{ result: CaseResult }>({ kind: "run", scenario }, onStage).then((r) => r.result);
export const verifyInWorker = (circuit: string, proof: string, publicInputs: string[]) => ask<{ valid: boolean; detail: string | null; ms: number }>({ kind: "verify", circuit, proof, publicInputs });
export const vkInWorker = (circuit: string) => ask<{ vk: string }>({ kind: "vk", circuit }).then((r) => r.vk);

/** What the run log and reports say about where a measurement came from. */
export function environment() {
  const n = navigator as Navigator & { deviceMemory?: number };
  return { label: "this browser and device", userAgent: n.userAgent, cores: n.hardwareConcurrency ?? null, threads: 1, memoryGb: n.deviceMemory ?? null };
}
