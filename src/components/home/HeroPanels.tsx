"use client";

import { useEffect, useMemo, useState } from "react";
import { useChain } from "@/components/providers/ChainProvider";
import { PauseIcon, PlayIcon } from "@/components/site/Icons";
import { bookLive, verifierLive } from "@/config/contracts";
import { CIRCUIT_IDS, CIRCUITS } from "@/lib/zk/core";
import { MANIFEST } from "@/lib/zk/facts";
import { useRuns } from "@/lib/zk/runlog";
import { scenariosOf } from "@/lib/zk/scenarios";

const WORDS = ["In motion", "In a worker", "In your browser", "Under test"];
const GLYPH = "01#/\\";

/** The boxed word of the headline: resolves letter by letter, then holds. */
export function RotatingWord() {
  const [text, setText] = useState(WORDS[0]);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let i = 0;
    let frame = 0;
    let timer = 0;
    const next = () => {
      i = (i + 1) % WORDS.length;
      const word = WORDS[i];
      let step = 0;
      const tick = () => {
        step += 1;
        const shown = Math.floor(step / 2);
        setText(word.slice(0, shown) + Array.from({ length: Math.max(0, word.length - shown) }, () => GLYPH[Math.floor(Math.random() * GLYPH.length)]).join(""));
        if (shown < word.length) frame = window.setTimeout(tick, 28);
        else timer = window.setTimeout(next, 2600);
      };
      tick();
    };
    timer = window.setTimeout(next, 2600);
    return () => {
      window.clearTimeout(frame);
      window.clearTimeout(timer);
    };
  }, []);
  return <span aria-hidden="true">{text}</span>;
}

/** Right-hand stream: real chain facts and the runs this browser logged. Nothing here is decorative data. */
export function EventStream() {
  const { facts, failed } = useChain();
  const { runs } = useRuns();
  const block = facts?.block ? String(facts.block) : "—";
  const rows = useMemo(() => {
    const local = runs.slice(0, 3).map((r) => ({ b: "local", e: r.kind.toUpperCase().replaceAll("_", " "), s: r.match ? "MATCH" : "DIFFERS", d: `${r.circuit}: ${r.actual.replaceAll("_", " ")}` }));
    const chain = [
      { b: block, e: "CHAIN_HEAD", s: failed ? "OFFLINE" : "LIVE", d: facts?.gasGwei != null ? `Gas ${facts.gasGwei.toFixed(4)} gwei` : "Reading gas" },
      { b: block, e: "ETH_USD", s: facts?.ethUsd ? "LIVE" : "WAITING", d: facts?.ethUsd ? `Chainlink feed $${facts.ethUsd.toFixed(2)}` : "Reading the feed" },
      { b: block, e: "RUN_BOOK", s: bookLive() ? "LIVE" : "NOT DEPLOYED", d: bookLive() ? `${facts?.book?.reports ?? "—"} anchored reports` : "Practice mode in this browser" },
      { b: block, e: "PATH_VERIFIER", s: verifierLive() ? "READY" : "NOT DEPLOYED", d: verifierLive() ? "Answers eth_call checks" : "Local verification still runs" },
      { b: "bundle", e: "CIRCUITS", s: "READY", d: `${CIRCUIT_IDS.length} compiled circuits served by this site` },
    ];
    return [...local, ...chain].slice(0, 7);
  }, [runs, block, failed, facts]);
  return (
    <>
      <div className="zf-aside-head">
        <span>Event stream</span>
        <em>{failed ? "Chain offline" : "Live"}</em>
      </div>
      <div className="zf-aside-body" data-testid="event-stream">
        <div className="zf-eventhead">
          <span>Block</span>
          <span>Event · State</span>
        </div>
        {rows.map((r, i) => (
          <div className="zf-eventrow" key={`${r.e}-${i}`}>
            <span className="b">{r.b}</span>
            <div className="min-w-0">
              <div className="h">
                <span className="zf-trunc">{r.e}</span>
                <em>{r.s}</em>
              </div>
              <div className="d">{r.d}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="zf-aside-foot">
        <span className="zf-sq" aria-hidden="true" />
        <span data-testid="live-block">Chain block {block}</span>
      </div>
    </>
  );
}

export function Marquee() {
  const [paused, setPaused] = useState(false);
  const items = CIRCUIT_IDS.map((id) => ({ id, m: MANIFEST[id], n: scenariosOf(id).length }));
  const row = (hidden: boolean) =>
    items.map((x) => (
      <li key={`${x.id}-${hidden}`} aria-hidden={hidden || undefined}>
        <b>{x.id}</b>
        <span>{(x.m.gates ?? 0).toLocaleString("en-US")} gates</span>
        <span>{x.n} cases</span>
        <em>{CIRCUITS[x.id].onChain ? "ON-CHAIN VERIFIER" : "LOCAL"}</em>
        <span>/</span>
      </li>
    ));
  return (
    <section className="zf-marquee" data-paused={paused} aria-label="Bundled circuits">
      <div className="zf-marquee-run">
        <ul>
          {row(false)}
          {row(true)}
          {row(true)}
          {row(true)}
        </ul>
      </div>
      <button type="button" className="zf-marquee-btn" onClick={() => setPaused((v) => !v)} aria-label={paused ? "Resume" : "Pause"} aria-pressed={paused}>
        {paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
      </button>
    </section>
  );
}
