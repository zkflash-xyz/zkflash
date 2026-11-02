"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircuitGlyph } from "@/components/home/CircuitBoard";
import { FieldForm } from "@/components/lab/LabWorkspace";
import { Frame } from "@/components/site/Frame";
import { fmtMs } from "@/components/monitor/TimingBins";
import { environment, runInWorker } from "@/lib/zk/client";
import { buildWitness, CIRCUIT_IDS, CIRCUITS, InputError, type CircuitId, type Values } from "@/lib/zk/core";
import type { CaseResult } from "@/lib/zk/engine";
import { circuitFacts, MANIFEST } from "@/lib/zk/facts";
import { makeReport, reportHash } from "@/lib/zk/report";
import { useReports, useRuns } from "@/lib/zk/runlog";
import { expectedFor, KIND_LABEL, OUTCOME_LABEL, scenariosOf, type Outcome, type Scenario, type ScenarioKind } from "@/lib/zk/scenarios";

export function ScenarioBuilder() {
  const [circuit, setCircuit] = useState<CircuitId>("hash_opening");
  const [customs, setCustoms] = useState<Scenario[]>([]);
  const [results, setResults] = useState<Record<string, CaseResult>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const { add: log } = useRuns();
  const { add: saveReport } = useReports();

  // Builder state
  const [kind, setKind] = useState<ScenarioKind>("tampered_proof_byte");
  const [values, setValues] = useState<Values>(CIRCUITS[circuit].defaults);
  const [label, setLabel] = useState("");
  const [expected, setExpected] = useState<Outcome>(expectedFor("tampered_proof_byte"));
  const [publicIndex, setPublicIndex] = useState(0);
  const [bytePct, setBytePct] = useState(50);

  const cases = useMemo(() => [...scenariosOf(circuit), ...customs.filter((s) => s.circuit === circuit)], [circuit, customs]);
  const done = cases.filter((s) => results[s.id]);
  const pick = (id: CircuitId) => {
    setCircuit(id);
    setValues(CIRCUITS[id].defaults);
    setPublicIndex(0);
    setError(null);
    setSaved(null);
  };

  async function runAll(list: Scenario[]) {
    setError(null);
    setSaved(null);
    for (const s of list) {
      setRunning(s.id);
      try {
        const r = await runInWorker(s);
        setResults((all) => ({ ...all, [s.id]: r }));
        log(r);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        break;
      }
    }
    setRunning(null);
  }

  function addCase() {
    setError(null);
    try {
      buildWitness(circuit, values);
    } catch (e) {
      if (e instanceof InputError) return setError(e.message);
      throw e;
    }
    const s: Scenario = { id: `${circuit}.custom.${Date.now()}`, circuit, kind, label: label.trim().slice(0, 80) || `Custom: ${KIND_LABEL[kind]}`, values, expected, publicIndex, byteAt: bytePct / 100 };
    setCustoms((all) => [...all, s]);
    setLabel("");
    return runAll([s]);
  }

  function makeTheReport() {
    const ordered = cases.flatMap((s) => (results[s.id] ? [results[s.id]] : []));
    const report = makeReport(circuitFacts(circuit), environment(), ordered);
    const hash = reportHash(report);
    saveReport({ hash, report });
    setSaved(hash);
  }

  return (
    <main id="main" className="zf-ws">
      <div className="zf-ws-head">
        <div>
          <h1>Scenarios</h1>
          <p>Write down what should happen, then see what did. Valid, invalid and tampered cases, with real proofs and expected against actual side by side.</p>
        </div>
        <small>{cases.length} cases for {circuit}</small>
      </div>
      <Frame className="zf-panes">
        <section className="zf-pane" aria-label="Circuits">
          <div className="zf-pane-head">
            <span>Circuit</span>
            <span>{CIRCUIT_IDS.length}</span>
          </div>
          <div style={{ paddingTop: 8 }}>
            {CIRCUIT_IDS.map((id) => (
              <button key={id} type="button" className="zf-listbtn" aria-pressed={circuit === id} onClick={() => pick(id)} data-testid={`scn-${id}`}>
                <CircuitGlyph id={id} />
                <span className="min-w-0">
                  <span className="zf-trunc" style={{ display: "block" }}>
                    {id}
                  </span>
                  <small>{scenariosOf(id).length} bundled cases</small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="zf-pane" aria-label="Results">
          <div className="zf-paneblock">
            <div className="zf-verdict">
              <div className="min-w-0">
                <h2 className="zf-paneh">{CIRCUITS[circuit].title}</h2>
                <p className="zf-note" style={{ marginTop: 0 }}>
                  {done.filter((s) => results[s.id].match).length} of {cases.length} cases as expected · {done.length} run
                </p>
              </div>
              <div className="zf-row">
                <button type="button" className="zf-btn solid sm" disabled={running !== null} onClick={() => runAll(cases)} data-testid="run-all">
                  {running ? "Running…" : "Run all"}
                </button>
                <button type="button" className="zf-btn sm" disabled={running !== null || done.length === 0} onClick={makeTheReport} data-testid="make-report">
                  Make report
                </button>
              </div>
            </div>
            {error ? <p className="zf-alert">{error}</p> : null}
            {saved ? (
              <p className="zf-okbox" data-testid="report-saved">
                Report saved in this browser.{" "}
                <Link href={`/reports?hash=${saved}`} style={{ textDecoration: "underline" }}>
                  Open it
                </Link>
              </p>
            ) : null}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="zf-log hide-sm" data-testid="scenario-table">
              <thead>
                <tr>
                  <th>Case</th>
                  <th>Expected</th>
                  <th>Actual</th>
                  <th className="num">Witness</th>
                  <th className="num">Proving</th>
                  <th className="num">Verify</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((s) => {
                  const r = results[s.id];
                  const ms = (stage: string) => fmtMs(r?.stages.find((x) => x.stage === stage)?.ms);
                  return (
                    <tr key={s.id} data-case={s.id}>
                      <td>
                        {s.label}
                        <br />
                        <span className="zf-mute">{KIND_LABEL[s.kind]}</span>
                      </td>
                      <td>{OUTCOME_LABEL[s.expected]}</td>
                      <td className={r && !r.match ? "zf-warn" : ""} data-testid="actual">
                        {running === s.id ? "Running…" : r ? OUTCOME_LABEL[r.actual] : "—"}
                        {r && !r.match ? " · differs" : ""}
                      </td>
                      <td className="num">{ms("witness")}</td>
                      <td className="num">{ms("proving")}</td>
                      <td className="num">{ms("verification")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="zf-paneblock">
            <p className="zf-note">Times are this browser and device, single run each, one prover thread. They are for comparing cases on your machine, not for claims about speed. Gate count {MANIFEST[circuit].gates?.toLocaleString("en-US")}.</p>
          </div>
        </section>

        <section className="zf-pane" aria-label="Case builder">
          <div className="zf-pane-head">
            <span>Test scenario builder</span>
          </div>
          <div className="zf-paneblock">
            <label className="zf-field" style={{ marginTop: 0 }}>
              <span>Name</span>
              <input className="zf-input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="What this case checks" maxLength={80} data-testid="case-label" />
            </label>
            <label className="zf-field">
              <span>Kind</span>
              <select
                className="zf-input"
                value={kind}
                data-testid="builder-kind"
                onChange={(e) => {
                  const k = e.target.value as ScenarioKind;
                  setKind(k);
                  setExpected(expectedFor(k));
                }}
              >
                {(Object.keys(KIND_LABEL) as ScenarioKind[]).map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </label>
            <label className="zf-field">
              <span>
                Expected outcome <em>you decide</em>
              </span>
              <select className="zf-input" value={expected} onChange={(e) => setExpected(e.target.value as Outcome)} data-testid="builder-expected">
                {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
                  <option key={o} value={o}>
                    {OUTCOME_LABEL[o]}
                  </option>
                ))}
              </select>
            </label>
            {kind === "tampered_public_input" ? (
              <label className="zf-field">
                <span>Public input to change</span>
                <select className="zf-input" value={publicIndex} onChange={(e) => setPublicIndex(Number(e.target.value))}>
                  {CIRCUITS[circuit].publicNames.map((n, i) => (
                    <option key={n} value={i}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {kind === "tampered_proof_byte" ? (
              <label className="zf-field">
                <span>
                  Byte to flip <em>{Math.floor((MANIFEST[circuit].proofBytes * bytePct) / 100)} of {MANIFEST[circuit].proofBytes}</em>
                </span>
                <input className="zf-input" type="range" min={0} max={99} value={bytePct} onChange={(e) => setBytePct(Number(e.target.value))} data-testid="byte-at" />
              </label>
            ) : null}
            <FieldForm circuit={circuit} values={values} onChange={setValues} />
            <button type="button" className="zf-btn solid wide zf-pad-t" disabled={running !== null} onClick={addCase} data-testid="add-case">
              Add case and run
            </button>
            <p className="zf-note">Custom cases last until you leave this page. Their results go in the report you make.</p>
          </div>
        </section>
      </Frame>
    </main>
  );
}
