"use client";

import { useEffect, useState } from "react";
import { useChain } from "@/components/providers/ChainProvider";
import { Frame } from "@/components/site/Frame";
import { ASSETS } from "@/config/assets";
import { CHAIN } from "@/config/brand";
import { bookLive, verifierLive } from "@/config/contracts";
import { CIRCUITS } from "@/lib/zk/core";
import { KIND_LABEL, OUTCOME_LABEL, SCENARIOS } from "@/lib/zk/scenarios";
import { VERIFY_GAS } from "@/content/measured";

/* Moving parts of this panel are decoration and read as such; the labels and numbers in it are real. */

const TILES = ["Inputs", "Witness", "Prove", "Verify", "Hash", "Report"];
const BATCH = ["inputs..", "witness..", "prove..", "verify..", "hash..", "report.."];

/** Deterministic pseudo-random so server and browser draw the same picture. */
const noise = (i: number, m: number) => Math.abs(Math.sin(i * 12.9898) * 43758.5453) % m;
const bitsText = (n: number, seed: number) => Array.from({ length: n }, (_, i) => (noise(i + seed, 1) > 0.5 ? "1" : "0")).join("");

export function PipelineTerminal() {
  const { facts } = useChain();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setInterval(() => document.visibilityState === "visible" && setTick((v) => v + 1), 1400);
    return () => window.clearInterval(t);
  }, []);
  const cells = Array.from({ length: 288 }, (_, i) => (noise(i + tick * 7, 1) > 0.94 ? "on" : ""));
  const bars = Array.from({ length: 34 }, (_, i) => 12 + Math.round(78 * Math.exp(-((i - 17) ** 2) / 34)) + (i % 3));
  return (
    <Frame className="zf-term">
      <div className="zf-term-bar">
        <span>
          <span className="zf-sq" aria-hidden="true" /> zkFlash / proof terminal
        </span>
        <span>
          <span className="zf-dot" aria-hidden="true" /> Illustrative motion
        </span>
      </div>
      <div className="zf-term-grid">
        <div className="zf-col">
          <div className="zf-mod">
            <h3>Input_cells</h3>
            <div className="zf-mod-in">
              <div className="zf-cells" aria-hidden="true">
                {cells.map((c, i) => (
                  <i key={i} className={c} />
                ))}
              </div>
            </div>
          </div>
          <div className="zf-mod" style={{ flex: "none" }}>
            <h3>Case_queue</h3>
            <div className="zf-mod-in">
              {(["valid", "invalid", "tampered_public_input", "tampered_proof_byte"] as const).map((k) => (
                <div className="zf-qrow" key={k}>
                  <b>CASE</b>
                  <span>{KIND_LABEL[k]}</span>
                </div>
              ))}
              {Object.values(CIRCUITS).map((c) => (
                <div className="zf-qrow" key={c.id}>
                  <b>CIRCUIT</b>
                  <span>{c.id}</span>
                </div>
              ))}
            </div>
            <p className="zf-cap">Valid + invalid + tampered</p>
          </div>
        </div>

        <div className="zf-col">
          <div className="zf-split">
            <div className="zf-mod">
              <h3>Case router</h3>
              <div className="zf-mod-in" style={{ padding: 0 }}>
                {SCENARIOS.slice(0, 8).map((s) => (
                  <div className="zf-route" key={s.id}>
                    <b>{s.kind === "valid" ? "TRUE" : s.kind === "invalid" ? "FALSE" : "TAMPER"}</b>
                    <span>{s.circuit}</span>
                    <em>{OUTCOME_LABEL[s.expected].split(" ").pop()}</em>
                  </div>
                ))}
              </div>
              <div className="zf-regfoot">
                <span>Expected ↔ actual</span>
                <span>{SCENARIOS.length} cases</span>
              </div>
            </div>
            <div className="zf-mod">
              <h3>Stage guard</h3>
              <div className="zf-mod-in">
                <div className="zf-minibars" aria-hidden="true">
                  {bars.map((h, i) => (
                    <i key={i} style={{ height: `${h}%` }} className={i === 17 + (tick % 8) - 4 ? "on" : ""} />
                  ))}
                </div>
                <div className="zf-guardtiles">
                  {TILES.map((t, i) => (
                    <span key={t} className={tick % TILES.length === i ? "on" : ""}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="zf-mod" style={{ flex: "none" }}>
            <h3>Prover</h3>
            <div className="zf-mod-in zf-exec">
              <div className="zf-execlines" aria-hidden="true">
                {Array.from({ length: 11 }, (_, r) => (
                  <div key={r}>
                    {[0, 1, 2, 3].map((c) => (
                      <i key={c} style={{ "--w": 1 + Math.floor(noise(r * 5 + c, 3)) } as React.CSSProperties} className={(tick + r) % 11 === 0 && c === 1 ? "on" : ""} />
                    ))}
                  </div>
                ))}
              </div>
              <div className="zf-bits" aria-hidden="true">
                {bitsText(540, tick)}
              </div>
            </div>
            <p className="zf-cap">Witness / prove / verify</p>
          </div>
        </div>

        <div className="zf-col">
          <div className="zf-mod">
            <h3>Check registry</h3>
            <div className="zf-mod-in">
              {["Circuit hash pinned", "Key hash pinned", "Input order bound", "Tamper cases on"].map((r) => (
                <div className="zf-regrow" key={r}>
                  <span>{r}</span>
                  <em>Active</em>
                </div>
              ))}
              {[0, 1].map((i) => (
                <div className="zf-regrow empty" key={i} />
              ))}
              <div className="zf-regfoot">
                <span>Checks per run</span>
                <span>4</span>
              </div>
            </div>
          </div>
          <div className="zf-mod" style={{ flex: "none" }}>
            <h3>Batch runner</h3>
            <div className="zf-mod-in">
              <div className="zf-batch">
                {Array.from({ length: 9 }, (_, i) => (
                  <span key={i} className={tick % 9 === i ? "on" : ""}>
                    {tick % 9 === i ? BATCH[tick % BATCH.length] : ""}
                  </span>
                ))}
              </div>
            </div>
            <p className="zf-cap">Proof verification path</p>
          </div>
        </div>

        <div className="zf-col">
          <div className="zf-mod">
            <h3>{CHAIN.name} · verifier</h3>
            <div className="zf-mod-in zf-verifier">
              <pre aria-hidden="true">{Array.from({ length: 22 }, (_, i) => bitsText(40, i * 41 + (tick % 4)).replace(/0/g, (m, o) => (noise(o + i, 1) > 0.6 ? " " : m))).join("\n")}</pre>
              <img src={ASSETS.bolt} alt="" width={512} height={512} loading="lazy" />
            </div>
            <div style={{ marginTop: 10 }}>
              <div className="zf-kv">
                <span>Verifier state</span>
                <b>{verifierLive() ? "Deployed" : "Not deployed yet"}</b>
              </div>
              <div className="zf-kv">
                <span>Run book</span>
                <b>{bookLive() ? "Deployed" : "Practice mode"}</b>
              </div>
              <div className="zf-kv">
                <span>Block</span>
                <b data-testid="pipeline-block">{facts?.block ? facts.block.toLocaleString("en-US") : "—"}</b>
              </div>
              <div className="zf-kv">
                <span>One check, measured</span>
                <b>{VERIFY_GAS}</b>
              </div>
            </div>
            <p className="zf-cap">Chain verification state</p>
          </div>
        </div>
      </div>
    </Frame>
  );
}
