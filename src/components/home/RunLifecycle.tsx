"use client";

import { useEffect, useRef, useState } from "react";
import { Frame, SectionHead } from "@/components/site/Frame";

const STEPS = [
  {
    key: "Prepare",
    title: "Prepare",
    text: "The worker loads the compiled circuit, the proving WASM and the public setup points from this site. Your form values become a witness in the shape the circuit expects.",
    note: "The first run of a session pays for loading. The timeline shows that as its own stage.",
    rows: [
      ["Where it runs", "A Web Worker in your browser"],
      ["Network", "Static files from this site only"],
      ["Inputs sent anywhere", "None"],
    ],
  },
  {
    key: "Prove",
    title: "Prove",
    text: "Noir solves the witness. If the statement is false, the circuit refuses here and no proof exists. If it holds, Barretenberg generates an UltraHonk proof on one thread.",
    note: "A refused witness is a result, not a crash. Invalid cases are expected to stop at this step.",
    rows: [
      ["Witness solver", "noir_js"],
      ["Proving system", "UltraHonk, EVM target"],
      ["Threads", "1"],
    ],
  },
  {
    key: "Verify",
    title: "Verify",
    text: "The proof is checked against the public inputs in the browser. For path_member the same proof can go to the Solidity verifier through a free eth_call once that contract is deployed.",
    note: "Tampered cases change one public input or one proof byte first, and must be rejected.",
    rows: [
      ["Local check", "Same worker, same key"],
      ["On-chain check", "path_member only, no gas for eth_call"],
      ["Tamper cases", "Input + 1, or one bit flipped"],
    ],
  },
  {
    key: "Report",
    title: "Report",
    text: "Cases, expected and actual results, timings, hashes and limitations go into one JSON file. Its hash can be anchored on the run book, and a second wallet can attest that it reproduced the outcomes.",
    note: "An anchor proves when a report was published. It does not prove the report is right.",
    rows: [
      ["Export", "JSON + Markdown"],
      ["Report hash", "Whole file, changes every run"],
      ["Outcomes hash", "Results only, repeats across machines"],
    ],
  },
];

/** Scroll position picks the step on wide screens; the buttons work everywhere. */
export function RunLifecycle() {
  const [step, setStep] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onScroll = () => {
      const el = root.current;
      if (!el || window.innerWidth < 1024) return;
      const r = el.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      if (span <= 0 || r.top > 0 || r.bottom < 0) return;
      setStep(Math.min(STEPS.length - 1, Math.floor((-r.top / span) * STEPS.length)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  const s = STEPS[step];
  return (
    <div className="zf-life" ref={root}>
      <div className="zf-life-in">
        <SectionHead index="05" label="Run lifecycle" />
        <h2 className="zf-h2" id="lifecycle">
          How a run moves
        </h2>
        <div className="zf-life-steps" role="group" aria-label="Lifecycle step">
          {STEPS.map((x, i) => (
            <button key={x.key} type="button" aria-pressed={step === i} onClick={() => setStep(i)}>
              0{i + 1} {x.key}
            </button>
          ))}
        </div>
        <Frame className="zf-life-panel" data-testid="lifecycle">
          <div className="min-w-0">
            <span className="zf-mono-label">0{step + 1} / 04</span>
            <h3 style={{ marginTop: 14 }}>{s.title}</h3>
            <p>{s.text}</p>
            <p className="zf-mute">{s.note}</p>
          </div>
          <div className="zf-life-rows">
            {s.rows.map(([k, v]) => (
              <div key={k}>
                <span>{k}</span>
                <em>{v}</em>
              </div>
            ))}
          </div>
        </Frame>
      </div>
    </div>
  );
}
