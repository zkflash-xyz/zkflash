"use client";

import { useMemo } from "react";
import type { RunEntry } from "@/lib/zk/runlog";
import type { StageName } from "@/lib/zk/engine";

/** Log-spaced bins so a 50 ms and a 20 s run fit one axis. Upper edges in milliseconds. */
export const EDGES = [25, 50, 100, 200, 400, 800, 1600, 3200, 6400, 12800, 25600, 51200, 102400];
export const edgeLabel = (ms: number) => (ms >= 1000 ? `${ms / 1000}s` : `${ms}ms`);

export function binCounts(values: number[]) {
  const counts = EDGES.map(() => 0);
  for (const v of values) {
    const i = EDGES.findIndex((e) => v <= e);
    counts[i === -1 ? EDGES.length - 1 : i] += 1;
  }
  return counts;
}

export const stageValues = (runs: RunEntry[], stage: StageName) => runs.flatMap((r) => r.stages.filter((s) => s.stage === stage).map((s) => s.ms));

export function median(values: number[]) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const fmtMs = (v: number | null | undefined) => (v == null ? "—" : v >= 1000 ? `${(v / 1000).toFixed(2)} s` : `${v.toFixed(0)} ms`);

/** One histogram of one stage. Single series, so no legend: the heading names it. Every bar has a hover value. */
export function TimingHistogram({ runs, stage = "proving" }: { runs: RunEntry[]; stage?: StageName }) {
  const values = useMemo(() => stageValues(runs, stage), [runs, stage]);
  const counts = useMemo(() => binCounts(values), [values]);
  const max = Math.max(1, ...counts);
  const top = counts.indexOf(Math.max(...counts));
  return (
    <div className="zf-binplot" role="img" aria-label={`${values.length} measured ${stage} times from this browser`} data-testid="timing-bins">
      {counts.map((c, i) => (
        <div className={`zf-bin${c ? " has" : ""}${c && i === top ? " top" : ""}`} key={EDGES[i]}>
          <i style={{ height: c ? `${(c / max) * 100}%` : 2 }} />
          <span className="zf-bintip">
            {i === 0 ? "up to " : `${edgeLabel(EDGES[i - 1])} to `}
            {edgeLabel(EDGES[i])}: {c} run{c === 1 ? "" : "s"}
          </span>
          {i % 2 === 0 ? <small>{edgeLabel(EDGES[i])}</small> : null}
        </div>
      ))}
    </div>
  );
}
