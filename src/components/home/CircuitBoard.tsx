"use client";

import Link from "next/link";
import { useState } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { ArrowUpRight, StarIcon } from "@/components/site/Icons";
import { storageKey } from "@/config/storage";
import { CIRCUIT_IDS, CIRCUITS, type CircuitId } from "@/lib/zk/core";
import { MANIFEST } from "@/lib/zk/facts";

const FILTERS = [
  { id: "all", label: "All circuits", test: () => true },
  { id: "chain", label: "On-chain check", test: (c: CircuitId) => CIRCUITS[c].onChain },
  { id: "local", label: "Local only", test: (c: CircuitId) => !CIRCUITS[c].onChain },
] as const;

export function CircuitGlyph({ id }: { id: CircuitId }) {
  const short = { hash_opening: "H", range_gate: "R", path_member: "P", tally_floor: "T" }[id];
  return (
    <span className="zf-glyph" aria-hidden="true">
      {short}
    </span>
  );
}

export function CircuitBoard() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [starred, setStarred] = useLocalStore<string[]>(storageKey("starred"), []);
  const f = FILTERS.find((x) => x.id === filter)!;
  const rows = CIRCUIT_IDS.filter(f.test).sort((a, b) => Number(starred.includes(b)) - Number(starred.includes(a)));
  return (
    <>
      <div className="zf-boardbar">
        <div className="zf-tabs" role="group" aria-label="Filter circuits">
          {FILTERS.map((x) => (
            <button key={x.id} type="button" aria-pressed={filter === x.id} onClick={() => setFilter(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <span className="zf-boardnote">
          <span className="zf-dot" aria-hidden="true" /> {rows.length} compiled in advance
        </span>
      </div>
      <div className="zf-table" data-testid="circuit-board">
        <div className="zf-trow head">
          <span />
          <span>Circuit</span>
          <span className="wide">Status</span>
          <span className="wide">System</span>
          <span className="wide r">Gates</span>
          <span className="wide r">Public</span>
          <span className="wide r">Proof bytes</span>
          <span className="wide">Circuit hash</span>
          <span />
        </div>
        {rows.map((id) => {
          const m = MANIFEST[id];
          const c = CIRCUITS[id];
          const on = starred.includes(id);
          return (
            <div className="zf-trow" key={id}>
              <button type="button" className="zf-star" aria-pressed={on} aria-label={`Pin ${c.title}`} onClick={() => setStarred((all) => (all.includes(id) ? all.filter((x) => x !== id) : [...all, id]))}>
                <StarIcon size={14} />
              </button>
              <div className="zf-namecell">
                <CircuitGlyph id={id} />
                <div className="min-w-0">
                  <strong>{id}</strong>
                  <span className={c.onChain ? "zf-chip-solid" : "zf-chip-line"}>{c.onChain ? "ON-CHAIN" : c.kind.toUpperCase()}</span>
                </div>
              </div>
              <span className="wide">READY</span>
              <span className="wide zf-trunc">UltraHonk</span>
              <span className="wide r">{m.gates?.toLocaleString("en-US") ?? "—"}</span>
              <span className="wide r">{m.publicInputs}</span>
              <span className="wide r">{m.proofBytes.toLocaleString("en-US")}</span>
              <span className="wide hash zf-trunc" title={m.circuitHash}>
                {m.circuitHash}
              </span>
              <Link href={`/lab?circuit=${id}`} className="zf-trowbtn">
                Run <ArrowUpRight size={11} />
              </Link>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18, paddingLeft: 6 }}>
        <Link href="/lab" className="zf-link">
          <span>Open the lab</span> <ArrowUpRight size={13} />
        </Link>
      </div>
    </>
  );
}
