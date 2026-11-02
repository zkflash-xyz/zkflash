"use client";

import { useCallback } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { storageKey } from "@/config/storage";
import type { CaseResult } from "./engine";
import type { Report } from "./report";

/* The run log and saved reports live only in this browser. Nothing here is sent anywhere. */

export type RunEntry = Omit<CaseResult, "proof"> & { at: number; cores: number | null };
export type SavedReport = { hash: string; report: Report };

export const RUNS_KEY = storageKey("runs");
export const REPORTS_KEY = storageKey("reports");
const MAX_RUNS = 300;
const MAX_REPORTS = 30;

export function useRuns() {
  const [runs, setRuns] = useLocalStore<RunEntry[]>(RUNS_KEY, []);
  const add = useCallback(
    (r: CaseResult) => {
      const entry: Partial<CaseResult> = { ...r };
      delete entry.proof;
      setRuns((all) => [{ ...(entry as Omit<CaseResult, "proof">), at: Date.now(), cores: navigator.hardwareConcurrency ?? null }, ...all].slice(0, MAX_RUNS));
    },
    [setRuns],
  );
  const clear = useCallback(() => setRuns([]), [setRuns]);
  return { runs, add, clear };
}

export function useReports() {
  const [reports, setReports] = useLocalStore<SavedReport[]>(REPORTS_KEY, []);
  const add = useCallback((saved: SavedReport) => setReports((all) => [saved, ...all.filter((x) => x.hash !== saved.hash)].slice(0, MAX_REPORTS)), [setReports]);
  const remove = useCallback((hash: string) => setReports((all) => all.filter((x) => x.hash !== hash)), [setReports]);
  return { reports, add, remove };
}
