"use client";

import Link from "next/link";
import { Frame } from "@/components/site/Frame";
import { fmtMs, median, stageValues, TimingHistogram } from "@/components/monitor/TimingBins";
import { useRuns } from "@/lib/zk/runlog";

export function HomeBins() {
  const { runs } = useRuns();
  const proving = stageValues(runs, "proving");
  return (
    <Frame className="zf-bins">
      <div className="zf-binhead">
        <span>Proving stage · measured in this browser</span>
        <em>
          {proving.length} run{proving.length === 1 ? "" : "s"} · median {fmtMs(median(proving))}
        </em>
      </div>
      <TimingHistogram runs={runs} />
      <div className="zf-binfoot">
        <span>{proving.length ? "Your numbers, from your device. Not a benchmark." : "Empty until you run a proof. We ship no sample timings."}</span>
        <Link href="/lab" className="zf-btn sm">
          Measure a run
        </Link>
      </div>
    </Frame>
  );
}
