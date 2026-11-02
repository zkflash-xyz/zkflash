"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useSyncExternalStore } from "react";
import { CircuitGlyph } from "@/components/home/CircuitBoard";
import { CopyValue } from "@/components/site/CaCopy";
import { Frame } from "@/components/site/Frame";
import { Timeline } from "@/components/lab/Timeline";
import { useProofRun } from "@/components/lab/useProofRun";
import { explorerAddress } from "@/config/brand";
import { CONTRACTS, verifierLive } from "@/config/contracts";
import { verifyOnChain } from "@/lib/book-chain";
import { buildWitness, CIRCUIT_IDS, CIRCUITS, InputError, type CircuitId, type Values } from "@/lib/zk/core";
import { environment, verifyInWorker, vkInWorker } from "@/lib/zk/client";
import { isCircuitId, MANIFEST } from "@/lib/zk/facts";
import { hashText } from "@/lib/zk/report";
import { expectedFor, KIND_LABEL, OUTCOME_LABEL, type ScenarioKind } from "@/lib/zk/scenarios";
import { keccak256 } from "viem";

type Tab = "generate" | "verify" | "inspect";

export function FieldForm({ circuit, values, onChange }: { circuit: CircuitId; values: Values; onChange: (v: Values) => void }) {
  return (
    <>
      {CIRCUITS[circuit].fields.map((f) => (
        <label className="zf-field" key={f.key}>
          <span>
            {f.label}
            <em>{f.secret ? "private" : "public"}</em>
          </span>
          <input className="zf-input" value={values[f.key] ?? ""} placeholder={f.hint} onChange={(e) => onChange({ ...values, [f.key]: e.target.value })} data-testid={`field-${f.key}`} spellCheck={false} autoComplete="off" />
        </label>
      ))}
    </>
  );
}

function VerifyPanel({ circuit, lastProof, lastInputs }: { circuit: CircuitId; lastProof: string; lastInputs: string[] }) {
  const [proof, setProof] = useState("");
  const [inputs, setInputs] = useState("");
  const [local, setLocal] = useState<null | { valid: boolean; detail: string | null; ms: number }>(null);
  const [chain, setChain] = useState<null | { valid: boolean; detail: string | null }>(null);
  const [busy, setBusy] = useState<"local" | "chain" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const parsed = useMemo(() => inputs.split(/[\s,]+/).filter(Boolean), [inputs]);
  const reset = () => {
    setLocal(null);
    setChain(null);
    setError(null);
  };
  const onChain = CIRCUITS[circuit].onChain;
  return (
    <div className="zf-paneblock">
      <h2 className="zf-paneh2">Verification engine</h2>
      <p className="zf-note">Paste a proof and its public inputs, or take the ones from your last run. The check happens in your browser.</p>
      <button
        type="button"
        className="zf-btn sm zf-pad-t"
        disabled={!lastProof}
        data-testid="use-last"
        onClick={() => {
          setProof(lastProof);
          setInputs(lastInputs.join("\n"));
          reset();
        }}
      >
        Use last proof
      </button>
      <label className="zf-field">
        <span>Proof hex</span>
        <textarea className="zf-input" value={proof} onChange={(e) => (setProof(e.target.value.trim()), reset())} spellCheck={false} data-testid="verify-proof" />
      </label>
      <label className="zf-field">
        <span>Public inputs, one per line</span>
        <textarea className="zf-input" value={inputs} onChange={(e) => (setInputs(e.target.value), reset())} spellCheck={false} data-testid="verify-inputs" />
      </label>
      <div className="zf-row zf-pad-t">
        <button
          type="button"
          className="zf-btn solid sm"
          disabled={!proof || busy !== null}
          data-testid="verify-local"
          onClick={async () => {
            setBusy("local");
            reset();
            try {
              setLocal(await verifyInWorker(circuit, proof, parsed));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "local" ? "Checking…" : "Check locally"}
        </button>
        <button
          type="button"
          className="zf-btn sm"
          disabled={!proof || busy !== null || !onChain || !verifierLive()}
          data-testid="verify-chain"
          onClick={async () => {
            setBusy("chain");
            setError(null);
            try {
              setChain(await verifyOnChain(proof, parsed));
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(null);
            }
          }}
        >
          {busy === "chain" ? "Calling…" : "Check on chain"}
        </button>
      </div>
      {!onChain ? (
        <p className="zf-note">Only path_member has an on-chain verifier. This circuit checks locally.</p>
      ) : !verifierLive() ? (
        <p className="zf-note" data-testid="verifier-missing">
          The on-chain verifier is not deployed yet, so this button stays off. Local verification runs the same key.
        </p>
      ) : (
        <p className="zf-note">
          eth_call to{" "}
          <a href={explorerAddress(CONTRACTS.verifier)} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            the verifier
          </a>
          . Costs no gas, sends nothing.
        </p>
      )}
      {local ? (
        <p className={local.valid ? "zf-okbox" : "zf-alert"} data-testid="verify-local-result">
          Local: {local.valid ? "proof accepted" : "proof rejected"} in {local.ms.toFixed(0)} ms, measured here.{local.detail ? ` ${local.detail}` : ""}
        </p>
      ) : null}
      {chain ? (
        <p className={chain.valid ? "zf-okbox" : "zf-alert"} data-testid="verify-chain-result">
          On chain: {chain.valid ? "the verifier returned true" : "the verifier rejected this proof"}.
        </p>
      ) : null}
      {error ? <p className="zf-alert">{error}</p> : null}
    </div>
  );
}

function InspectPanel({ circuit, proof, inputs }: { circuit: CircuitId; proof: string; inputs: string[] }) {
  const m = MANIFEST[circuit];
  const c = CIRCUITS[circuit];
  const [live, setLive] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rows: [string, string][] = [
    ["Circuit hash", m.circuitHash],
    ["Key hash (bundled)", m.vkHash],
    ["Proving system", m.provingSystem],
    ["Noir", m.noirVersion],
    ["Gates", m.gates?.toLocaleString("en-US") ?? "—"],
    ["ACIR opcodes", m.opcodes?.toLocaleString("en-US") ?? "—"],
    ["Proof size", `${m.proofBytes.toLocaleString("en-US")} bytes`],
    ["Key size", `${m.vkBytes.toLocaleString("en-US")} bytes`],
  ];
  return (
    <div className="zf-paneblock" data-testid="inspector">
      <h2 className="zf-paneh2">Proof inspector</h2>
      <dl className="m-0">
        {rows.map(([k, v]) => (
          <div className="zf-copyrow" key={k} style={{ marginTop: 12 }}>
            <div className="min-w-0">
              <dt className="zf-mono-label">{k}</dt>
              <dd className="m-0 zf-mono zf-break" style={{ fontSize: 11.5, lineHeight: "18px" }}>
                {v}
              </dd>
            </div>
            {v.startsWith("0x") ? <CopyValue value={v} /> : null}
          </div>
        ))}
      </dl>
      <button
        type="button"
        className="zf-btn sm zf-pad-t"
        disabled={busy}
        data-testid="vk-check"
        onClick={async () => {
          setBusy(true);
          try {
            setLive(keccak256((await vkInWorker(circuit)) as `0x${string}`));
          } catch (e) {
            setLive(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "Deriving…" : "Derive key hash here"}
      </button>
      {live ? (
        <p className={live === m.vkHash ? "zf-okbox" : "zf-alert"} data-testid="vk-result">
          {live === m.vkHash ? "Your browser derived the same key hash as the bundle." : `Different result: ${live}`}
        </p>
      ) : null}
      <div style={{ marginTop: 18 }}>
        <span className="zf-mono-label">Public inputs of the last run</span>
        {inputs.length ? (
          inputs.map((v, i) => (
            <p className="zf-mono zf-break" key={i} style={{ margin: "6px 0 0", fontSize: 11, lineHeight: "16px" }}>
              <span className="zf-mute">{c.publicNames[i] ?? i}: </span>
              {v}
            </p>
          ))
        ) : (
          <p className="zf-note">Run a proof to see them.</p>
        )}
      </div>
      {proof ? (
        <div style={{ marginTop: 18 }}>
          <span className="zf-mono-label">Last proof · keccak256</span>
          <p className="zf-mono zf-break" style={{ margin: "6px 0 0", fontSize: 11, lineHeight: "16px" }} data-testid="proof-hash">
            {hashOf(proof)}
          </p>
        </div>
      ) : null}
    </div>
  );
}
const hashOf = (hex: string) => {
  try {
    return keccak256(hex as `0x${string}`);
  } catch {
    return hashText(hex);
  }
};

export function LabWorkspace({ firstCircuit, firstTab }: { firstCircuit?: string; firstTab?: string }) {
  const router = useRouter();
  const [circuit, setCircuit] = useState<CircuitId>(isCircuitId(firstCircuit) ? firstCircuit : "hash_opening");
  const [tab, setTab] = useState<Tab>(firstTab === "verify" ? "verify" : firstTab === "inspect" ? "inspect" : "generate");
  const [values, setValues] = useState<Values>(CIRCUITS[circuit].defaults);
  const [kind, setKind] = useState<ScenarioKind>("valid");
  const [q, setQ] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const { run, running, stages, result, error } = useProofRun();
  const cores = useSyncExternalStore(
    () => () => {},
    () => environment().cores,
    () => null,
  );
  const c = CIRCUITS[circuit];
  const shown = CIRCUIT_IDS.filter((id) => `${id} ${CIRCUITS[id].title} ${CIRCUITS[id].kind}`.toLowerCase().includes(q.toLowerCase()));

  const pick = (id: CircuitId) => {
    setCircuit(id);
    setValues(CIRCUITS[id].defaults);
    setInputError(null);
    router.replace(`/lab?circuit=${id}`, { scroll: false });
  };

  const go = () => {
    setInputError(null);
    try {
      buildWitness(circuit, values);
    } catch (e) {
      if (e instanceof InputError) return setInputError(e.message);
      throw e;
    }
    run({ id: `${circuit}.custom.${kind}`, circuit, kind, label: `Lab run: ${KIND_LABEL[kind]}`, values, expected: expectedFor(kind), publicIndex: 0, byteAt: 0.5 });
  };

  return (
    <main id="main" className="zf-ws">
      <div className="zf-ws-head">
        <div>
          <h1>Lab</h1>
          <p>Generate a real proof in your browser, watch each stage, then check it. Nothing you type leaves this device.</p>
        </div>
        <small>Robinhood Chain · 4663 · proofs run locally</small>
      </div>
      <Frame className="zf-panes">
        <section className="zf-pane" aria-label="Circuits">
          <div className="zf-pane-head">
            <span>Circuits</span>
            <span>{CIRCUIT_IDS.length}</span>
          </div>
          <input className="zf-search" placeholder="Search circuits" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search circuits" />
          {shown.map((id) => (
            <button key={id} type="button" className="zf-listbtn" aria-pressed={circuit === id} onClick={() => pick(id)} data-testid={`circuit-${id}`}>
              <CircuitGlyph id={id} />
              <span className="min-w-0">
                <span className="zf-trunc" style={{ display: "block" }}>
                  {id}
                </span>
                <small>{CIRCUITS[id].kind}{CIRCUITS[id].onChain ? " · on-chain check" : ""}</small>
              </span>
            </button>
          ))}
          {shown.length === 0 ? <p className="zf-empty">No circuit by that name.</p> : null}
          <div className="zf-paneblock" style={{ marginTop: "auto", borderTop: "1px solid var(--line)" }}>
            <span className="zf-tag planned">Planned</span>
            <p className="zf-note">Uploading your own circuit is planned, not built. This lab runs the four bundled ones.</p>
          </div>
        </section>

        <section className="zf-pane" aria-label="Proof timeline">
          <div className="zf-paneblock">
            <div className="zf-namecell">
              <CircuitGlyph id={circuit} />
              <div className="min-w-0">
                <h2 className="zf-paneh" data-testid="circuit-title">
                  {c.title}
                </h2>
                <p className="zf-note" style={{ marginTop: 0 }}>
                  {MANIFEST[circuit].provingSystem} · {MANIFEST[circuit].gates?.toLocaleString("en-US")} gates
                </p>
              </div>
            </div>
          </div>
          <div className="zf-paneblock">
            <span className="zf-mono-label">Statement</span>
            <p className="zf-note" style={{ fontSize: 14.5, lineHeight: "22px" }}>
              {c.statement}
            </p>
            <dl className="m-0" style={{ display: "grid", gap: 10, marginTop: 14 }}>
              <div>
                <dt className="zf-mono-label">Reveals</dt>
                <dd className="zf-note m-0">{c.reveals}</dd>
              </div>
              <div>
                <dt className="zf-mono-label">Keeps out of the proof</dt>
                <dd className="zf-note m-0">{c.hides}</dd>
              </div>
              <div>
                <dt className="zf-mono-label">Does not prove</dt>
                <dd className="zf-note m-0">{c.doesNotProve}</dd>
              </div>
            </dl>
          </div>
          <div className="zf-paneblock">
            <div className="zf-verdict">
              <div>
                <span className="zf-mono-label">Result</span>
                <strong data-testid="run-outcome">{running ? "Running" : result ? OUTCOME_LABEL[result.actual] : "No run yet"}</strong>
              </div>
              {result ? (
                <span className={`zf-tag${result.match ? " on" : ""}`} data-testid="run-match">
                  <i /> {result.match ? "As expected" : "Not as expected"}
                </span>
              ) : null}
            </div>
            {result?.detail ? <p className="zf-note zf-mono zf-break">{result.detail}</p> : null}
            {error ? <p className="zf-alert">{error}</p> : null}
            <Timeline stages={stages} running={running} />
            <p className="zf-note">
              Measured on this browser and device{cores ? `, ${cores} logical cores reported` : ""}, one prover thread. Your next run or another machine will differ, and this is not a benchmark.
            </p>
          </div>
          <dl className="zf-grid-stats m-0">
            <div>
              <dt>Proof size</dt>
              <dd data-testid="proof-size">{result?.proofBytes ? `${result.proofBytes.toLocaleString("en-US")} bytes` : "—"}</dd>
            </div>
            <div>
              <dt>Public inputs</dt>
              <dd>{result ? result.publicInputs.length : "—"}</dd>
            </div>
            <div>
              <dt>Expected</dt>
              <dd>{OUTCOME_LABEL[expectedFor(kind)]}</dd>
            </div>
          </dl>
        </section>

        <section className="zf-pane" aria-label="Controls">
          <div className="zf-tabbar" role="group" aria-label="Lab tools">
            {(["generate", "verify", "inspect"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} data-testid={`tab-${t}`}>
                {t}
              </button>
            ))}
          </div>
          {tab === "generate" ? (
            <div className="zf-paneblock">
              <span className="zf-mono-label">Proof generator</span>
              <h2 className="zf-paneh2" style={{ marginTop: 6 }}>
                Generate
              </h2>
              <label className="zf-field">
                <span>Case</span>
                <select className="zf-input" value={kind} onChange={(e) => setKind(e.target.value as ScenarioKind)} data-testid="case-kind">
                  {(Object.keys(KIND_LABEL) as ScenarioKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </label>
              <FieldForm circuit={circuit} values={values} onChange={setValues} />
              {inputError ? (
                <p className="zf-alert" data-testid="input-error">
                  {inputError}
                </p>
              ) : null}
              <button type="button" className="zf-btn solid wide zf-pad-t" onClick={go} disabled={running} data-testid="run-proof">
                {running ? "Proving in a worker…" : "Generate proof"}
              </button>
              <p className="zf-note">Private values stay in the worker. The bundled circuits are test material: do not put real secrets in them.</p>
            </div>
          ) : tab === "verify" ? (
            <VerifyPanel circuit={circuit} lastProof={result?.proof ?? ""} lastInputs={result?.publicInputs ?? []} />
          ) : (
            <InspectPanel circuit={circuit} proof={result?.proof ?? ""} inputs={result?.publicInputs ?? []} />
          )}
        </section>
      </Frame>
    </main>
  );
}
