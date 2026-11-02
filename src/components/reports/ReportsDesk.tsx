"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CopyValue } from "@/components/site/CaCopy";
import { Frame } from "@/components/site/Frame";
import { fmtMs } from "@/components/monitor/TimingBins";
import { PRACTICE_WALLETS, useBook, type BookApi } from "@/components/reports/useBook";
import { CHAIN, explorerAddress, explorerTx, shortAddress } from "@/config/brand";
import { CONTRACTS, verifierLive } from "@/config/contracts";
import { reportStateLabel, ROLE, ZERO_ADDRESS, ZERO_HASH, type ReportView } from "@/lib/book";
import { CIRCUIT_IDS, CIRCUITS, type CircuitId } from "@/lib/zk/core";
import { verifyInWorker } from "@/lib/zk/client";
import { MANIFEST } from "@/lib/zk/facts";
import { checkReport, reportMarkdown, type Report } from "@/lib/zk/report";
import { useReports, type SavedReport } from "@/lib/zk/runlog";
import { OUTCOME_LABEL } from "@/lib/zk/scenarios";

type Tab = "anchor" | "attest" | "workspace";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Hash({ k, v }: { k: string; v: string }) {
  return (
    <div className="zf-copyrow" style={{ marginTop: 12 }}>
      <div className="min-w-0">
        <span className="zf-mono-label">{k}</span>
        <p className="zf-mono zf-break m-0" style={{ fontSize: 11, lineHeight: "17px" }}>
          {v}
        </p>
      </div>
      <CopyValue value={v} />
    </div>
  );
}

function Status({ book }: { book: BookApi }) {
  return (
    <>
      {book.error ? (
        <p className="zf-alert" role="alert" data-testid="book-error">
          {book.error}
        </p>
      ) : null}
      {book.lastTx ? (
        <p className="zf-okbox" data-testid="book-tx">
          Sent.{" "}
          <a href={explorerTx(book.lastTx)} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            View the transaction
          </a>
        </p>
      ) : null}
    </>
  );
}

function WalletLine({ book }: { book: BookApi }) {
  if (book.live) return <p className="zf-note">{book.me ? <>Signing as <code>{shortAddress(book.me)}</code>.</> : "Connect a wallet to write. Reading needs none."}</p>;
  return (
    <div>
      <span className="zf-tag" data-testid="practice-badge">
        <i /> Practice mode: nothing is sent
      </span>
      <p className="zf-note">The contract is not deployed yet, so this runs the same rules in your browser. Switch wallets to try a second-wallet attestation.</p>
      <div className="zf-tabs zf-pad-t" role="group" aria-label="Practice wallet">
        {(["A", "B"] as const).map((w) => (
          <button key={w} type="button" aria-pressed={book.who === w} onClick={() => book.setWho(w)} data-testid={`practice-${w}`}>
            Wallet {w}
          </button>
        ))}
      </div>
    </div>
  );
}

function AnchorTab({ book, saved }: { book: BookApi; saved: SavedReport | null }) {
  const { view } = book;
  const wanted = saved?.report.circuit.circuitHash;
  const usable = view.circuits.filter((c) => c.state === 1 && view.workspaces.some((w) => w.id === c.workspaceId && (w.myRole === 1 || w.myRole === 2)));
  const [chosen, setChosen] = useState<number | null>(null);
  const match = usable.find((c) => c.circuitHash === wanted);
  const circuitId = chosen ?? match?.id ?? usable[0]?.id ?? null;
  const circuit = usable.find((c) => c.id === circuitId);
  const mismatch = circuit && wanted && circuit.circuitHash !== wanted;
  return (
    <div className="zf-paneblock">
      <span className="zf-mono-label">Run book</span>
      <h2 className="zf-paneh2" style={{ marginTop: 6 }}>
        Anchor this report
      </h2>
      <WalletLine book={book} />
      {!saved ? (
        <p className="zf-note">Pick a report on the left first, or make one in <Link href="/scenarios" style={{ textDecoration: "underline" }}>Scenarios</Link>.</p>
      ) : usable.length === 0 ? (
        <p className="zf-note" data-testid="need-circuit">
          You need an active circuit in a workspace where you are a lead or runner. Set that up in the Workspace tab.
        </p>
      ) : (
        <>
          <label className="zf-field">
            <span>Registered circuit</span>
            <select className="zf-input" value={circuitId ?? ""} onChange={(e) => setChosen(Number(e.target.value))} data-testid="anchor-circuit">
              {usable.map((c) => (
                <option key={c.id} value={c.id}>
                  #{c.id} {c.name} v{c.version}
                </option>
              ))}
            </select>
          </label>
          {mismatch ? <p className="zf-alert">This circuit hash differs from the one in the report. Anchoring is allowed, but the record will not line up.</p> : null}
          <button
            type="button"
            className="zf-btn solid wide zf-pad-t"
            disabled={book.busy || circuitId === null}
            data-testid="anchor-go"
            onClick={() =>
              circuitId !== null &&
              book.exec({ kind: "anchorReport", circuitId, reportHash: saved.hash, outcomesHash: saved.report.outcomesHash, proofHash: saved.report.proof?.hash ?? ZERO_HASH, passed: saved.report.summary.passed, failed: saved.report.summary.failed, uri: "" })
            }
          >
            {book.busy ? "Confirm in wallet…" : book.live ? "Anchor on chain" : "Anchor in practice"}
          </button>
          <p className="zf-note">Only hashes and case counts go on chain. The report file stays with you, so keep it if you want others to check it.</p>
        </>
      )}
      <Status book={book} />
    </div>
  );
}

function AttestTab({ book, target, saved }: { book: BookApi; target: ReportView | null; saved: SavedReport | null }) {
  const [hash, setHash] = useState("");
  const [localCheck, setLocalCheck] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const circuit = target ? book.view.circuits.find((c) => c.id === target.circuitId) : null;
  const canCheck = target && saved && saved.report.proof && saved.report.proof.hash === target.proofHash && circuit;
  const hasVerifier = circuit && circuit.verifier !== ZERO_ADDRESS;
  return (
    <div className="zf-paneblock">
      <span className="zf-mono-label">Second wallet</span>
      <h2 className="zf-paneh2" style={{ marginTop: 6 }}>
        Attest a report
      </h2>
      <WalletLine book={book} />
      {!target ? (
        <p className="zf-note">Pick an anchored report on the left.</p>
      ) : (
        <>
          <p className="zf-note">Run the same circuit&apos;s scenarios on your own machine, make a report, and paste its outcomes hash. The contract compares it with the anchored one. Same hash: reproduced. Different hash: not reproduced.</p>
          <label className="zf-field">
            <span>Your outcomes hash</span>
            <input className="zf-input" value={hash} onChange={(e) => setHash(e.target.value.trim())} placeholder="0x…" spellCheck={false} data-testid="attest-hash" />
          </label>
          <button type="button" className="zf-btn sm zf-pad-t" onClick={() => saved && setHash(saved.report.outcomesHash)} disabled={!saved}>
            Use the open report&apos;s hash
          </button>
          <div className="zf-row zf-pad-t">
            <button
              type="button"
              className="zf-btn solid sm"
              disabled={book.busy || !/^0x[0-9a-fA-F]{64}$/.test(hash)}
              data-testid="attest-yes"
              onClick={() => book.exec({ kind: "attest", reportId: target.id, verdict: 1, resultHash: hash })}
            >
              Reproduced
            </button>
            <button
              type="button"
              className="zf-btn sm"
              disabled={book.busy || !/^0x[0-9a-fA-F]{64}$/.test(hash)}
              data-testid="attest-no"
              onClick={() => book.exec({ kind: "attest", reportId: target.id, verdict: 2, resultHash: hash })}
            >
              Not reproduced
            </button>
          </div>
          <p className="zf-note">Attestations are counted per wallet and one person can hold many wallets. Read them as a signal, not as proof that a report is right.</p>
          <hr style={{ margin: "18px 0", borderColor: "var(--line)" }} />
          <span className="zf-mono-label">Proof check</span>
          {!canCheck ? (
            <p className="zf-note">Open the matching report file to check its proof. {target.proofHash === ZERO_HASH ? "This report carries no proof." : ""}</p>
          ) : book.live && (!hasVerifier) ? (
            <p className="zf-note">This circuit names no verifier contract, so a proof check on chain is not available.</p>
          ) : (
            <>
              <button
                type="button"
                className="zf-btn sm zf-pad-t"
                disabled={book.busy || checking}
                data-testid="check-proof"
                onClick={async () => {
                  const proof = saved.report.proof!;
                  setLocalCheck(null);
                  if (!book.live) {
                    // Practice: the browser verifier stands in for the contract's call.
                    setChecking(true);
                    const id = saved.report.circuit.id;
                    const r = await verifyInWorker(id, proof.hex, proof.publicInputs).catch(() => ({ valid: false, detail: null, ms: 0 }));
                    setChecking(false);
                    setLocalCheck(r.valid ? "Local verifier accepted this proof." : "Local verifier rejected this proof.");
                    if (r.valid) await book.exec({ kind: "checkReportProof", reportId: target.id, proof: proof.hex, publicInputs: proof.publicInputs });
                    return;
                  }
                  await book.exec({ kind: "checkReportProof", reportId: target.id, proof: proof.hex, publicInputs: proof.publicInputs });
                }}
              >
                {checking ? "Checking…" : book.live ? "Run the proof through the verifier (about 3M gas)" : "Check in practice"}
              </button>
              {localCheck ? <p className="zf-okbox">{localCheck}</p> : null}
            </>
          )}
          {target.state === 1 && book.me && target.author.toLowerCase() === book.me.toLowerCase() ? (
            <button type="button" className="zf-btn sm zf-pad-t" style={{ display: "flex" }} disabled={book.busy} data-testid="withdraw" onClick={() => book.exec({ kind: "withdrawReport", reportId: target.id })}>
              Withdraw this report
            </button>
          ) : null}
        </>
      )}
      <Status book={book} />
    </div>
  );
}

function WorkspaceTab({ book }: { book: BookApi }) {
  const { view } = book;
  const [name, setName] = useState("");
  const [only, setOnly] = useState(false);
  const [wsChoice, setWs] = useState<number | null>(null);
  const ws = view.workspaces.find((w) => w.id === wsChoice) ?? view.workspaces.find((w) => w.myRole === 1) ?? view.workspaces[0] ?? null;
  const [who, setWho] = useState("");
  const [role, setRole] = useState(2);
  const [circuit, setCircuit] = useState<CircuitId>("path_member");
  const invites = view.workspaces.filter((w) => w.myInvite !== 0);
  const isLead = ws?.myRole === 1;
  const mineCircuits = view.circuits.filter((c) => c.workspaceId === ws?.id);
  const whoOk = /^0x[0-9a-fA-F]{40}$/.test(who);
  return (
    <div className="zf-paneblock">
      <span className="zf-mono-label">Roles per workspace</span>
      <h2 className="zf-paneh2" style={{ marginTop: 6 }}>
        Workspace
      </h2>
      <WalletLine book={book} />
      {invites.map((w) => (
        <div className="zf-okbox" key={w.id}>
          Invited to {w.name} as {ROLE[w.myInvite]}.{" "}
          <button type="button" className="zf-btn sm" disabled={book.busy} data-testid="accept-invite" onClick={() => book.exec({ kind: "acceptInvite", workspaceId: w.id })}>
            Accept
          </button>
        </div>
      ))}
      <label className="zf-field">
        <span>New workspace name</span>
        <input className="zf-input" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} placeholder="1 to 32 plain characters" data-testid="ws-name" />
      </label>
      <label className="zf-check">
        <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Only reviewers and leads may attest
      </label>
      <button
        type="button"
        className="zf-btn sm zf-pad-t"
        disabled={book.busy}
        data-testid="ws-create"
        onClick={async () => {
          if (await book.exec({ kind: "createWorkspace", name: name.trim(), reviewersOnly: only })) setName("");
        }}
      >
        Create workspace
      </button>
      {ws ? (
        <>
          <hr style={{ margin: "18px 0", borderColor: "var(--line)" }} />
          <label className="zf-field">
            <span>Workspace</span>
            <select className="zf-input" value={ws.id} onChange={(e) => setWs(Number(e.target.value))} data-testid="ws-select">
              {view.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  #{w.id} {w.name}
                </option>
              ))}
            </select>
          </label>
          <p className="zf-note" data-testid="ws-role">
            You: {ROLE[ws.myRole] === "None" ? "not a member" : ROLE[ws.myRole]}. {ws.members} member{ws.members === 1 ? "" : "s"}, {ws.leads} lead{ws.leads === 1 ? "" : "s"}. {ws.reviewersOnly ? "Reviewers and leads attest." : "Any other wallet can attest."}
          </p>
          {isLead ? (
            <>
              <label className="zf-field">
                <span>Register a bundled circuit</span>
                <select className="zf-input" value={circuit} onChange={(e) => setCircuit(e.target.value as CircuitId)} data-testid="reg-circuit">
                  {CIRCUIT_IDS.map((id) => (
                    <option key={id} value={id}>
                      {id}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="zf-btn sm zf-pad-t"
                disabled={book.busy}
                data-testid="reg-go"
                onClick={() => book.exec({ kind: "registerCircuit", workspaceId: ws.id, name: circuit, circuitHash: MANIFEST[circuit].circuitHash, vkHash: MANIFEST[circuit].vkHash, verifier: CIRCUITS[circuit].onChain && verifierLive() ? CONTRACTS.verifier : "", uri: "" })}
              >
                Register {circuit}
              </button>
              <label className="zf-field">
                <span>Invite a wallet</span>
                <input className="zf-input" value={who} onChange={(e) => setWho(e.target.value.trim())} placeholder={book.live ? "0x…" : PRACTICE_WALLETS.B} spellCheck={false} data-testid="invite-who" />
              </label>
              <label className="zf-field">
                <span>Role</span>
                <select className="zf-input" value={role} onChange={(e) => setRole(Number(e.target.value))} data-testid="invite-role">
                  <option value={1}>Lead</option>
                  <option value={2}>Runner</option>
                  <option value={3}>Reviewer</option>
                </select>
              </label>
              <div className="zf-row zf-pad-t">
                <button type="button" className="zf-btn sm" disabled={book.busy || !whoOk} data-testid="invite-go" onClick={() => book.exec({ kind: "invite", workspaceId: ws.id, who, role })}>
                  Send invite
                </button>
                <button type="button" className="zf-btn sm" disabled={book.busy || !whoOk} onClick={() => book.exec({ kind: "removeMember", workspaceId: ws.id, who })}>
                  Remove member
                </button>
              </div>
              <label className="zf-check">
                <input type="checkbox" checked={ws.reviewersOnly} disabled={book.busy} onChange={(e) => book.exec({ kind: "setReviewersOnly", workspaceId: ws.id, reviewersOnly: e.target.checked })} /> Only reviewers and leads may attest
              </label>
            </>
          ) : ws.myRole !== 0 ? (
            <button type="button" className="zf-btn sm zf-pad-t" disabled={book.busy || !book.me} onClick={() => book.me && book.exec({ kind: "removeMember", workspaceId: ws.id, who: book.me })}>
              Leave this workspace
            </button>
          ) : null}
          {mineCircuits.length ? (
            <div style={{ marginTop: 16 }} data-testid="ws-circuits">
              <span className="zf-mono-label">Circuits registered</span>
              {mineCircuits.map((c) => (
                <div className="zf-copyrow" key={c.id} style={{ marginTop: 8, fontSize: 12 }}>
                  <span className="zf-mono zf-break">
                    #{c.id} {c.name} v{c.version} · {["—", "Active", "Superseded", "Retired"][c.state]}
                  </span>
                  {isLead && c.state === 1 ? (
                    <button type="button" className="zf-btn sm" disabled={book.busy} onClick={() => book.exec({ kind: "retireCircuit", circuitId: c.id })}>
                      Retire
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
      <Status book={book} />
      {!book.live ? (
        <button type="button" className="zf-btn sm zf-pad-t" onClick={book.reset} data-testid="practice-reset">
          Clear practice data
        </button>
      ) : null}
    </div>
  );
}

function ReportBody({ saved, onRemove }: { saved: SavedReport; onRemove: () => void }) {
  const r = saved.report;
  return (
    <>
      <div className="zf-paneblock">
        <div className="zf-verdict">
          <div className="min-w-0">
            <h2 className="zf-paneh" data-testid="report-title">
              {r.circuit.title}
            </h2>
            <p className="zf-note" style={{ marginTop: 0 }}>
              {new Date(r.createdAt).toLocaleString()} · {r.environment.label}
            </p>
          </div>
          <span className={`zf-tag${r.summary.failed ? "" : " on"}`} data-testid="report-summary">
            <i /> {r.summary.passed} of {r.summary.total} as expected
          </span>
        </div>
        <div className="zf-row zf-pad-t">
          <button type="button" className="zf-btn sm" data-testid="export-json" onClick={() => download(`zkflash-${r.circuit.id}-${saved.hash.slice(2, 10)}.json`, JSON.stringify(r, null, 2), "application/json")}>
            Export JSON
          </button>
          <button type="button" className="zf-btn sm" data-testid="export-md" onClick={() => download(`zkflash-${r.circuit.id}-${saved.hash.slice(2, 10)}.md`, reportMarkdown(r, saved.hash), "text/markdown")}>
            Export Markdown
          </button>
          <button type="button" className="zf-btn sm" onClick={onRemove}>
            Remove from this browser
          </button>
        </div>
      </div>
      <div className="zf-paneblock">
        <Hash k="Report hash" v={saved.hash} />
        <Hash k="Outcomes hash" v={r.outcomesHash} />
        <Hash k="Circuit hash" v={r.circuit.circuitHash} />
        <Hash k="Key hash" v={r.circuit.vkHash} />
        {r.proof ? <Hash k={`Proof hash · ${r.proof.bytes} bytes`} v={r.proof.hash} /> : null}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="zf-log hide-sm" data-testid="report-cases">
          <thead>
            <tr>
              <th>Case</th>
              <th>Expected</th>
              <th>Actual</th>
              <th className="num">Proving</th>
              <th className="num">Verify</th>
            </tr>
          </thead>
          <tbody>
            {r.cases.map((c) => (
              <tr key={c.scenarioId}>
                <td>{c.label}</td>
                <td>{OUTCOME_LABEL[c.expected]}</td>
                <td className={c.match ? "" : "zf-warn"}>{OUTCOME_LABEL[c.actual]}</td>
                <td className="num">{fmtMs(c.stages.find((s) => s.stage === "proving")?.ms)}</td>
                <td className="num">{fmtMs(c.stages.find((s) => s.stage === "verification")?.ms)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="zf-paneblock">
        <span className="zf-mono-label">Limitations, written into the file</span>
        <ul className="m-0" data-testid="report-limits">
          {r.limitations.map((l) => (
            <li className="zf-note" key={l}>
              {l}
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function UploadCheck({ onAdd }: { onAdd: (s: SavedReport) => void }) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <div className="zf-paneblock">
      <span className="zf-mono-label">Check a report file</span>
      <input
        className="zf-input"
        type="file"
        accept="application/json,.json"
        aria-label="Report JSON file"
        data-testid="report-file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          setMessage(null);
          if (file.size > 2_000_000) return setMessage({ ok: false, text: "That file is too large to be a report." });
          try {
            const raw = JSON.parse(await file.text()) as Report;
            const check = checkReport(raw);
            if (check.ok && check.reportHash) {
              onAdd({ hash: check.reportHash, report: raw });
              setMessage({ ok: true, text: `Hashes recomputed: ${check.reportHash}` });
            } else setMessage({ ok: false, text: check.problems.join(" ") });
          } catch {
            setMessage({ ok: false, text: "That file is not valid JSON." });
          }
        }}
      />
      {message ? (
        <p className={message.ok ? "zf-okbox" : "zf-alert"} data-testid="report-file-result">
          {message.text}
        </p>
      ) : null}
      <p className="zf-note">The file is read in your browser only.</p>
    </div>
  );
}

export function ReportsDesk({ firstHash }: { firstHash?: string }) {
  const book = useBook();
  const { reports, add, remove } = useReports();
  const [selected, setSelected] = useState<string | null>(firstHash ?? null);
  const [tab, setTab] = useState<Tab>("anchor");
  const [q, setQ] = useState("");
  const saved = reports.find((r) => r.hash === selected) ?? reports[0] ?? null;
  const anchoredByHash = useMemo(() => new Map(book.view.reports.map((r) => [r.reportHash.toLowerCase(), r])), [book.view.reports]);
  const [chainPick, setChainPick] = useState<number | null>(null);
  const target = book.view.reports.find((r) => r.id === chainPick) ?? (saved ? (anchoredByHash.get(saved.hash.toLowerCase()) ?? null) : null) ?? book.view.reports[0] ?? null;
  const shownLocal = reports.filter((r) => `${r.report.circuit.id} ${r.hash}`.toLowerCase().includes(q.toLowerCase()));
  const circuitOf = (r: ReportView) => book.view.circuits.find((c) => c.id === r.circuitId);
  return (
    <main id="main" className="zf-ws">
      <div className="zf-ws-head" style={{ paddingInline: 4 }}>
        <div>
          <span className="zf-mono-label">Verification reports</span>
          <h1 style={{ font: "400 30px/38px var(--mono)", letterSpacing: 0, textTransform: "none", marginTop: 6 }}>Reports</h1>
          <p>Results, configuration and limits in one file. Anchor its hash on {CHAIN.name} and let another wallet check your work.</p>
        </div>
        <Link href="/scenarios" className="zf-btn solid">
          + New report
        </Link>
      </div>
      <Frame className="zf-panes">
        <section className="zf-pane" aria-label="Report list">
          <div className="zf-pane-head">
            <span>In this browser</span>
            <span>{reports.length}</span>
          </div>
          <input className="zf-search" placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search reports" />
          {shownLocal.map((r) => (
            <button key={r.hash} type="button" className="zf-listbtn" aria-pressed={saved?.hash === r.hash} onClick={() => setSelected(r.hash)} data-testid="local-report">
              <span className="min-w-0">
                <span className="zf-trunc" style={{ display: "block" }}>
                  {r.report.circuit.id}
                </span>
                <small>
                  {r.report.summary.passed}/{r.report.summary.total} · {shortAddress(r.hash)}
                </small>
              </span>
            </button>
          ))}
          {reports.length === 0 ? <p className="zf-empty">No reports yet.</p> : null}
          <div className="zf-pane-head" style={{ borderTop: "1px solid var(--line)" }}>
            <span>{book.live ? "Anchored on chain" : "Anchored in practice"}</span>
            <span data-testid="anchored-total">{book.view.totals.reports}</span>
          </div>
          <div style={{ paddingTop: 8 }}>
            {book.loading ? <p className="zf-empty">Reading the chain…</p> : null}
            {book.readError ? <p className="zf-alert" style={{ margin: 8 }}>{book.readError}</p> : null}
            {book.view.reports.map((r) => (
              <button
                key={r.id}
                type="button"
                className="zf-listbtn"
                aria-pressed={target?.id === r.id}
                data-testid="anchored-report"
                onClick={() => {
                  setChainPick(r.id);
                  setTab("attest");
                }}
              >
                <span className="min-w-0">
                  <span className="zf-trunc" style={{ display: "block" }}>
                    #{r.id} {circuitOf(r)?.name ?? "circuit"}
                  </span>
                  <small data-testid="anchored-state">
                    {reportStateLabel(r.state)} · {r.reproduced} reproduced{r.proofCheckedAt ? " · proof checked" : ""}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="zf-pane" aria-label="Report">
          {saved ? (
            <ReportBody
              saved={saved}
              onRemove={() => {
                remove(saved.hash);
                setSelected(null);
              }}
            />
          ) : (
            <div className="zf-paneblock">
              <p className="zf-empty">
                No report open. <Link href="/scenarios" style={{ textDecoration: "underline" }}>Run the scenarios of a circuit</Link> and press Make report, or check a file below.
              </p>
            </div>
          )}
          <UploadCheck
            onAdd={(s) => {
              add(s);
              setSelected(s.hash);
            }}
          />
          {target ? (
            <div className="zf-paneblock" data-testid="anchored-detail">
              <span className="zf-mono-label">Anchored report #{target.id}</span>
              <p className="zf-note">
                State: <b data-testid="target-state">{reportStateLabel(target.state)}</b>. Author <code>{shortAddress(target.author)}</code>. {target.passed} matched, {target.failed} differed, self-reported. {target.reproduced} reproduced, {target.notReproduced} not reproduced, {target.reviewerReproduced} from reviewers.{" "}
                {target.proofCheckedAt ? <>Proof checked <span data-testid="target-proof">{new Date(target.proofCheckedAt * 1000).toLocaleString()}</span>.</> : "Proof not checked yet."}
              </p>
              <Hash k="Anchored report hash" v={target.reportHash} />
              <Hash k="Anchored outcomes hash" v={target.outcomesHash} />
              {saved ? (
                <p className={saved.hash.toLowerCase() === target.reportHash.toLowerCase() ? "zf-okbox" : "zf-note"} data-testid="hash-compare">
                  {saved.hash.toLowerCase() === target.reportHash.toLowerCase() ? "The open file hashes to exactly this anchor." : saved.report.outcomesHash.toLowerCase() === target.outcomesHash.toLowerCase() ? "The open file is a different run with the same outcomes." : "The open file does not match this anchor."}
                </p>
              ) : null}
              {book.live && circuitOf(target)?.verifier && circuitOf(target)?.verifier !== ZERO_ADDRESS ? (
                <p className="zf-note">
                  Verifier named by this circuit:{" "}
                  <a href={explorerAddress(circuitOf(target)!.verifier)} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
                    {shortAddress(circuitOf(target)!.verifier)}
                  </a>
                  . The workspace chose it, so compare it with the address in the docs.
                </p>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className="zf-pane" aria-label="Actions">
          <div className="zf-tabbar" role="group" aria-label="Report actions">
            {(["anchor", "attest", "workspace"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)} data-testid={`rtab-${t}`}>
                {t}
              </button>
            ))}
          </div>
          {tab === "anchor" ? <AnchorTab book={book} saved={saved} /> : tab === "attest" ? <AttestTab book={book} target={target} saved={saved} /> : <WorkspaceTab book={book} />}
        </section>
      </Frame>
    </main>
  );
}


