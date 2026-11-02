"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useChain } from "@/components/providers/ChainProvider";
import { Frame, PageHero } from "@/components/site/Frame";
import { fmtMs, median, stageValues, TimingHistogram } from "@/components/monitor/TimingBins";
import { STAGES } from "@/components/lab/useProofRun";
import { CIRCUIT_IDS } from "@/lib/zk/core";
import type { StageName } from "@/lib/zk/engine";
import { MANIFEST } from "@/lib/zk/facts";
import { useRuns } from "@/lib/zk/runlog";
import { KIND_LABEL, OUTCOME_LABEL } from "@/lib/zk/scenarios";

export function MonitorView() {
  const { runs, clear } = useRuns();
  const { facts } = useChain();
  const [stage, setStage] = useState<StageName>("proving");
  const values = useMemo(() => stageValues(runs, stage), [runs, stage]);
  const asExpected = runs.filter((r) => r.match).length;
  return (
    <main id="main" className="zf-page">
      <PageHero
        title="Monitor"
        text="Times measured in this browser on this device, and stored only here. There are no sample numbers and no fleet average. An empty page means you have not run anything yet."
        side={
          <dl className="zf-tiles m-0" data-testid="monitor-tiles">
            <div>
              <dt>Runs logged</dt>
              <dd data-testid="monitor-runs">{runs.length}</dd>
            </div>
            <div>
              <dt>As expected</dt>
              <dd>{runs.length ? asExpected : "—"}</dd>
            </div>
            <div>
              <dt>Chain block</dt>
              <dd data-testid="monitor-block">{facts?.block ?? "—"}</dd>
            </div>
          </dl>
        }
      />
      <h2 className="zf-h3-big">Time per stage</h2>
      <div className="zf-tabs" role="group" aria-label="Stage" style={{ marginTop: 20 }}>
        {STAGES.map((s) => (
          <button key={s} type="button" aria-pressed={stage === s} onClick={() => setStage(s)}>
            {s}
          </button>
        ))}
      </div>
      <Frame className="zf-bins" style={{ marginTop: 16 }}>
        <div className="zf-binhead">
          <span>{stage[0].toUpperCase() + stage.slice(1)} · this browser and device</span>
          <em>
            {values.length} measured · median {fmtMs(median(values))}
          </em>
        </div>
        <TimingHistogram runs={runs} stage={stage} />
      </Frame>

      <h2 className="zf-h3-big">By circuit</h2>
      <div className="zf-lines" data-testid="monitor-circuits">
        {CIRCUIT_IDS.map((id) => {
          const mine = runs.filter((r) => r.circuit === id);
          return (
            <div className="zf-line" key={id}>
              <div className="min-w-0">
                <strong>{id}</strong>
                <small>{MANIFEST[id].gates?.toLocaleString("en-US")} gates · {mine.length} runs here</small>
              </div>
              <dl className="zf-tiles m-0" style={{ gap: 22 }}>
                {STAGES.map((s) => (
                  <div key={s}>
                    <dt style={{ fontSize: 9.5 }}>{s}</dt>
                    <dd style={{ fontSize: 14, lineHeight: "20px", marginTop: 4 }}>{fmtMs(median(stageValues(mine, s)))}</dd>
                  </div>
                ))}
              </dl>
              <Link href={`/lab?circuit=${id}`} className="zf-trowbtn" style={{ padding: "0 12px" }}>
                Run
              </Link>
            </div>
          );
        })}
      </div>
      <p className="zf-lede" style={{ marginTop: 14 }}>
        Medians of whatever you ran, across every case kind, in one browser. The first run of a session also pays for loading WASM, which the preparation stage shows.
      </p>

      <div className="zf-verdict" style={{ marginTop: 72 }}>
        <h2 className="zf-h3-big" style={{ margin: 0 }}>
          Recent runs
        </h2>
        <button type="button" className="zf-btn sm" onClick={clear} disabled={!runs.length} data-testid="clear-log">
          Clear this log
        </button>
      </div>
      {runs.length === 0 ? (
        <p className="zf-empty">
          Nothing measured here yet. <Link href="/lab" style={{ textDecoration: "underline" }}>Run a proof in the lab</Link>.
        </p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 14 }}>
          <table className="zf-log hide-sm" data-testid="monitor-log">
            <thead>
              <tr>
                <th>Circuit</th>
                <th>Case</th>
                <th>Result</th>
                <th>When</th>
                <th className="num">Proving</th>
                <th className="num">Verify</th>
              </tr>
            </thead>
            <tbody>
              {runs.slice(0, 25).map((r, i) => (
                <tr key={`${r.at}-${i}`}>
                  <td>{r.circuit}</td>
                  <td>{KIND_LABEL[r.kind]}</td>
                  <td className={r.match ? "" : "zf-warn"}>{OUTCOME_LABEL[r.actual]}</td>
                  <td>{new Date(r.at).toLocaleTimeString()}</td>
                  <td className="num">{fmtMs(r.stages.find((s) => s.stage === "proving")?.ms)}</td>
                  <td className="num">{fmtMs(r.stages.find((s) => s.stage === "verification")?.ms)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
