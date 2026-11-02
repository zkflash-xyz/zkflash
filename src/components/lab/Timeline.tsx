"use client";

import { fmtMs } from "@/components/monitor/TimingBins";
import { STAGES } from "@/components/lab/useProofRun";
import type { StageTime } from "@/lib/zk/engine";

const LABEL: Record<string, string> = { preparation: "Preparation", witness: "Witness", proving: "Proving", verification: "Verification" };

/** Proof timeline: one bar per stage on a shared scale, each with its measured time. Same hue, so names carry identity. */
export function Timeline({ stages, running }: { stages: StageTime[]; running: boolean }) {
  const max = Math.max(1, ...stages.map((s) => s.ms));
  const nextIndex = stages.length;
  return (
    <div className="zf-stages" data-testid="timeline">
      {STAGES.map((name, i) => {
        const s = stages.find((x) => x.stage === name);
        const active = running && !s && i === nextIndex;
        const skipped = !running && !s && stages.length > 0;
        return (
          <div className={`zf-stage${active ? " active" : ""}${skipped ? " skipped" : ""}`} key={name} data-stage={name} title={s ? `${LABEL[name]}: ${s.ms.toFixed(1)} ms` : undefined}>
            <b>{LABEL[name]}</b>
            <span className="t">
              <i style={{ width: active ? "18%" : s ? `${(s.ms / max) * 100}%` : 0 }} />
            </span>
            <em>{s ? fmtMs(s.ms) : active ? "Running" : skipped ? "Not reached" : "—"}</em>
          </div>
        );
      })}
    </div>
  );
}
