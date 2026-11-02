"use client";

import { useCallback, useState } from "react";
import { runInWorker } from "@/lib/zk/client";
import type { CaseResult, StageName, StageTime } from "@/lib/zk/engine";
import { useRuns } from "@/lib/zk/runlog";
import type { Scenario } from "@/lib/zk/scenarios";

export const STAGES: StageName[] = ["preparation", "witness", "proving", "verification"];

/** One run at a time from a component: live stage list, final result, and an entry in this browser's log. */
export function useProofRun() {
  const { add } = useRuns();
  const [running, setRunning] = useState(false);
  const [stages, setStages] = useState<StageTime[]>([]);
  const [result, setResult] = useState<CaseResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (scenario: Scenario) => {
      setRunning(true);
      setStages([]);
      setResult(null);
      setError(null);
      try {
        const r = await runInWorker(scenario, (s) => setStages((all) => [...all, s]));
        setResult(r);
        add(r);
        return r;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        setRunning(false);
      }
    },
    [add],
  );
  return { run, running, stages, result, error };
}
