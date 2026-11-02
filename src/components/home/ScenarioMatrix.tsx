"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CircuitGlyph } from "@/components/home/CircuitBoard";
import { CIRCUITS } from "@/lib/zk/core";
import { useRuns } from "@/lib/zk/runlog";
import { KIND_LABEL, OUTCOME_LABEL, SCENARIOS, type ScenarioKind } from "@/lib/zk/scenarios";

const FILTERS: { id: "all" | ScenarioKind; label: string }[] = [
  { id: "all", label: "All cases" },
  { id: "valid", label: "Valid" },
  { id: "invalid", label: "Invalid" },
  { id: "tampered_public_input", label: "Tampered input" },
  { id: "tampered_proof_byte", label: "Tampered proof" },
];

export function ScenarioFilters({ value, onChange }: { value: string; onChange: (v: "all" | ScenarioKind) => void }) {
  return (
    <div className="zf-tabs" role="group" aria-label="Filter cases">
      {FILTERS.map((x) => (
        <button key={x.id} type="button" aria-pressed={value === x.id} onClick={() => onChange(x.id)}>
          {x.label}
        </button>
      ))}
    </div>
  );
}

export function ScenarioMatrix() {
  const [filter, setFilter] = useState<"all" | ScenarioKind>("all");
  const { runs } = useRuns();
  const last = useMemo(() => {
    const map = new Map<string, (typeof runs)[number]>();
    for (const r of runs) if (!map.has(r.scenarioId)) map.set(r.scenarioId, r);
    return map;
  }, [runs]);
  const rows = SCENARIOS.filter((s) => filter === "all" || s.kind === filter);
  return (
    <>
      <div style={{ marginTop: 28 }}>
        <ScenarioFilters value={filter} onChange={setFilter} />
      </div>
      <div className="zf-matrix" data-testid="scenario-matrix">
        {rows.map((s) => {
          const r = last.get(s.id);
          return (
            <div className="zf-mrow" key={s.id}>
              <div className="zf-namecell">
                <CircuitGlyph id={s.circuit} />
                <div className="min-w-0">
                  <strong className="zf-break">{s.circuit}</strong>
                  <small>{s.label}</small>
                </div>
              </div>
              <dl className="m-0">
                <dt>Case kind</dt>
                <dd>{KIND_LABEL[s.kind]}</dd>
              </dl>
              <dl className="m-0">
                <dt>Expected</dt>
                <dd>{OUTCOME_LABEL[s.expected]}</dd>
              </dl>
              <dl className="m-0">
                <dt>Last result here</dt>
                <dd className={r ? (r.match ? "" : "zf-warn") : "zf-mute"}>{r ? `${OUTCOME_LABEL[r.actual]}${r.match ? "" : " · differs"}` : "Not run in this browser"}</dd>
              </dl>
            </div>
          );
        })}
      </div>
      <p className="zf-lede" style={{ marginTop: 16 }}>
        {CIRCUITS.path_member.title} is the one circuit with a Solidity verifier. <Link href="/scenarios" style={{ textDecoration: "underline" }}>Run these or build your own</Link>.
      </p>
    </>
  );
}
