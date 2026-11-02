import type { Metadata } from "next";
import Link from "next/link";
import { CircuitBoard, CircuitGlyph } from "@/components/home/CircuitBoard";
import { HomeBins } from "@/components/home/HomeBins";
import { EventStream, Marquee, RotatingWord } from "@/components/home/HeroPanels";
import { PipelineTerminal } from "@/components/home/PipelineTerminal";
import { RunLifecycle } from "@/components/home/RunLifecycle";
import { ScenarioMatrix } from "@/components/home/ScenarioMatrix";
import { JsonLd } from "@/components/JsonLd";
import { CaRow } from "@/components/site/CaCopy";
import { Frame, SectionHead, TitleRow } from "@/components/site/Frame";
import { ArrowRight, ArrowUpRight } from "@/components/site/Icons";
import { ASSETS } from "@/config/assets";
import { BRAND } from "@/config/brand";
import { CIRCUIT_IDS, CIRCUITS, hash1, samplePath, toHex32 } from "@/lib/zk/core";
import { MANIFEST } from "@/lib/zk/facts";
import { SCENARIOS } from "@/lib/zk/scenarios";
import { appLd, HOME_DESCRIPTION, HOME_TITLE, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/", title: HOME_TITLE, description: HOME_DESCRIPTION });

const LANES = [
  {
    tag: "In your browser",
    on: false,
    title: "Local prover",
    text: "Four Noir circuits, compiled in advance and served by this site. Proving runs in a Web Worker, so inputs stay on your device and the page stays responsive.",
    items: ["Four bundled circuits", "UltraHonk in WASM", "Valid + invalid + tampered", "Timings from your clock"],
    cta: "Open the lab",
    href: "/lab",
  },
  {
    tag: "Optional",
    on: false,
    title: "On-chain check",
    text: "The path_member circuit has a generated Solidity verifier. Send the same proof to it through a free eth_call and compare the answer with the local one.",
    items: ["One bundled verifier", "eth_call costs no gas", "Rejects tampered bytes", "Bytes you can verify"],
    cta: "Run a check",
    href: "/lab?circuit=path_member&tab=verify",
  },
  {
    tag: "Public record",
    on: true,
    title: "Anchored report",
    text: "Export a report with its limits written down, anchor its hash on the run book, and let a second wallet attest that it reproduced the same outcomes.",
    items: ["JSON + Markdown export", "Workspace roles", "Second-wallet attestation", "No fee, no admin"],
    cta: "Open reports",
    href: "/reports",
  },
];

const CLAIMS: [string, string, string, boolean?, boolean?][] = [
  ["The statement in the circuit", "Shown", "Shown, through the proof it names"],
  ["Who generated the proof", "Not shown", "Only which wallet anchored the hash", true],
  ["That inputs are true in the world", "Not shown", "Not shown", true, true],
  ["Timings on another device", "Not shown", "Not shown", true, true],
  ["Your private inputs", "Stay in your browser", "Never in a report as plain values"],
  ["Public inputs and the proof", "Stay in your browser", "Inside the exported file; only its hash goes on chain"],
  ["Your wallet address", "Not needed", "Public on chain", true],
  ["Independent reproduction", "Not shown", "Counted, one per wallet. One person can hold many wallets"],
];

const ROADMAP = [
  { phase: "Phase 1", state: "Live", planned: false, title: "Proof lab", bar: 100, items: ["Four bundled circuits", "Browser proving in a worker", "Local verification"] },
  { phase: "Phase 2", state: "Live", planned: false, title: "Testing", bar: 100, items: ["Scenario builder", "Timeline + monitor", "Reports with limits"] },
  { phase: "Phase 3", state: "Live", planned: false, title: "On-chain record", bar: 100, items: ["Run book contract", "Path verifier", "Verified source on the explorer"] },
  { phase: "Phase 4", state: "Planned", planned: true, title: "Custom circuits", bar: 0, items: ["Upload your own circuit", "Hosted test runs", "Larger circuits"] },
  { phase: "Phase 5", state: "Planned", planned: true, title: "Integration", bar: 0, items: ["Developer SDK and API", `${BRAND.symbol} credits`, "Premium reports"] },
];

const CONTRACTS = [
  ["ZkflashRunBook.sol", "Workspaces with roles, circuit registry, report anchors, second-wallet attestations", "Core"],
  ["ZkflashPathCheck.sol", "Verifier generated from the path_member circuit", "Proof"],
  ["ZkflashSpongeTape.sol", "Linked library of the verifier: Fiat-Shamir transcript", "Library"],
  ["ZkflashGateChecks.sol", "Linked library of the verifier: gate relations", "Library"],
];

export default function Home() {
  const root = toHex32(samplePath(hash1(BigInt(CIRCUITS.path_member.defaults.secret)), Number(CIRCUITS.path_member.defaults.index)).root);
  return (
    <main id="main">
      <JsonLd data={appLd} />
      <section className="zf-hero">
        <div className="zf-hero-grid">
          <aside className="zf-aside l">
            <div className="zf-aside-head">
              <span>Circuits</span>
              <em>{CIRCUIT_IDS.length} bundled</em>
            </div>
            <div className="zf-aside-body">
              {CIRCUIT_IDS.map((id) => (
                <Link key={id} href={`/lab?circuit=${id}`} className="zf-poolrow">
                  <CircuitGlyph id={id} />
                  <span className="min-w-0">
                    <strong className="zf-trunc">{id}</strong>
                    <small>{CIRCUITS[id].kind} · {MANIFEST[id].gates?.toLocaleString("en-US")} gates</small>
                  </span>
                  <span className="st">
                    Ready
                    <small>{MANIFEST[id].publicInputs} public</small>
                  </span>
                </Link>
              ))}
            </div>
            <div className="zf-aside-foot">
              <span className="zf-sq" aria-hidden="true" />
              Compiled in advance
            </div>
          </aside>
          <div className="zf-center">
            <div className="zf-center-bar">
              <span>{BRAND.name} / proof testing studio</span>
              <span>Live data from Robinhood Chain</span>
            </div>
            <div className="zf-center-in">
              <Frame className="zf-title-frame">
                <div className="zf-title-inner">
                  <CaRow testid="hero-ca" />
                  <p className="zf-kicker">Zero-knowledge testing · Robinhood Chain</p>
                  <div className="zf-pair">
                    <span>
                      <img src={ASSETS.mark} alt="" width={26} height={26} />
                      <span>
                        <b>{BRAND.name.toUpperCase()}</b>
                        <small>{BRAND.domain}</small>
                      </span>
                    </span>
                    <span aria-hidden="true">×</span>
                    <span>
                      <span className="zf-glyph" style={{ width: 26, height: 26, fontSize: 9 }} aria-hidden="true">
                        N
                      </span>
                      <span>
                        <b>NOIR</b>
                        <small>UltraHonk proofs</small>
                      </span>
                    </span>
                  </div>
                  <h1 className="zf-h1">
                    <span className="sr-only-x">{BRAND.name}: {BRAND.slogan}</span>
                    <span aria-hidden="true">Proof</span>
                    <span className="box">
                      <RotatingWord />
                    </span>
                    <span aria-hidden="true">Results in view</span>
                  </h1>
                </div>
              </Frame>
              <Frame className="zf-sub" as="div">
                <p className="m-0">{BRAND.tagline} Real circuits. Your own clock. Limits written down.</p>
              </Frame>
              <div className="zf-actions">
                <a href="#lanes" className="zf-btn">
                  Explore features
                </a>
                <Link href="/scenarios" className="zf-btn">
                  Test scenarios
                </Link>
                <Link href="/lab" className="zf-btn solid">
                  Open lab <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
          <aside className="zf-aside r">
            <EventStream />
          </aside>
        </div>
        <Marquee />
      </section>

      <section className="zf-section" aria-labelledby="pipeline">
        <SectionHead index="00" label="Proof pipeline" />
        <TitleRow id="pipeline" line1="One pipeline." line2="Every stage in view." side="Inputs become a witness, a witness becomes a proof, and a proof meets a verifier. zkFlash shows each stage with its own measured time, so a failed test tells you where it stopped." />
        <PipelineTerminal />
        <p className="zf-lede zf-trunc" style={{ marginTop: 12 }}>
          Sample tree root behind path_member: <code title={root}>{root}</code>
        </p>
      </section>

      <section className="zf-section" aria-labelledby="board">
        <SectionHead index="01" label="Circuits" />
        <div className="zf-title-row">
          <h2 className="zf-h2" id="board">
            Every circuit.
            <span>One board.</span>
          </h2>
          <dl className="zf-stats m-0">
            <div>
              <dt>Circuits</dt>
              <dd>{CIRCUIT_IDS.length}</dd>
            </div>
            <div>
              <dt>Cases</dt>
              <dd>{SCENARIOS.length}</dd>
            </div>
            <div>
              <dt>On chain</dt>
              <dd>{CIRCUIT_IDS.filter((c) => CIRCUITS[c].onChain).length}</dd>
            </div>
          </dl>
        </div>
        <CircuitBoard />
      </section>

      <section className="zf-section" aria-labelledby="matrix">
        <SectionHead index="02" label="Scenario matrix" />
        <h2 className="zf-h2" id="matrix" style={{ marginTop: 26 }}>
          Beyond the happy path.
        </h2>
        <p className="zf-lede" style={{ marginTop: 18, maxWidth: 720 }}>
          A proof system earns trust by what it refuses. Each circuit ships with a true statement, a false one, a changed public input and a flipped proof byte, with the expected outcome written down before anything runs.
        </p>
        <ScenarioMatrix />
      </section>

      <section className="zf-section" id="lanes" aria-labelledby="lanes-t">
        <SectionHead index="03" label="Three lanes" />
        <TitleRow id="lanes-t" line1="One studio." line2="Clear results." side={`${BRAND.name} keeps local results, chain checks and public records apart, and labels which one you are looking at. A green check in your browser never reads as a claim on chain.`} />
        <div className="zf-lanes">
          {LANES.map((l) => (
            <Frame className="zf-lane" as="article" key={l.title}>
              <span className={`zf-tag${l.on ? " on" : ""}`} style={{ alignSelf: "flex-start" }}>
                <i /> {l.tag}
              </span>
              <h3>{l.title}</h3>
              <p>{l.text}</p>
              <ul>
                {l.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <Link href={l.href} className="zf-link">
                <span>{l.cta}</span> <ArrowUpRight size={13} />
              </Link>
            </Frame>
          ))}
        </div>
      </section>

      <section className="zf-section" aria-labelledby="bins">
        <SectionHead index="04" label="Timing bins" />
        <TitleRow id="bins" line1="Proving time," line2="in bins." side="Every run you make lands in a bin. The chart reads your browser's own log and starts empty on purpose, because a timing is only true for the machine that measured it." />
        <HomeBins />
      </section>

      <section className="zf-section">
        <RunLifecycle />
      </section>

      <section className="zf-section" aria-labelledby="claims">
        <SectionHead index="06" label="Limits" />
        <TitleRow id="claims" line1="What a report" line2="does not say." side="Vague claims help nobody testing a circuit. Here is what a local run shows, what an anchored report adds, and everything neither of them can tell you." />
        <Frame className="zf-claims">
          <div className="zf-crow head">
            <span>Question</span>
            <span>
              <span className="zf-tag">
                <i /> Local run
              </span>
            </span>
            <span>
              <span className="zf-tag on">
                <i /> Anchored report
              </span>
            </span>
          </div>
          {CLAIMS.map(([q, a, b, dimA, dimB]) => (
            <div className="zf-crow" key={q}>
              <span>{q}</span>
              <span className={dimA ? "zf-mute" : ""}>{a}</span>
              <span className={dimB ? "zf-mute" : ""}>{b}</span>
            </div>
          ))}
        </Frame>
      </section>

      <section className="zf-section" aria-labelledby="road">
        <SectionHead index="07" label="Roadmap" />
        <h2 className="zf-h2" id="road" style={{ marginTop: 26 }}>
          What runs.
          <span>What is planned.</span>
        </h2>
        <div className="zf-road" tabIndex={0} aria-label="Roadmap phases">
          {ROADMAP.map((p) => (
            <Frame className="zf-phase" as="article" key={p.phase}>
              <header>
                <span>{p.phase}</span>
                <b className={p.planned ? "p" : ""}>{p.state}</b>
              </header>
              <h3>{p.title}</h3>
              <ul>
                {p.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
              <div className="bar" aria-hidden="true">
                <i style={{ width: `${p.bar}%` }} />
              </div>
            </Frame>
          ))}
        </div>
      </section>

      <section className="zf-section zf-contracts" aria-labelledby="contracts">
        <div className="min-w-0">
          <SectionHead index="08" label="Contracts" />
          <h2 className="zf-h2" id="contracts" style={{ marginTop: 26 }}>
            The contracts.
          </h2>
          <p className="zf-lede" style={{ marginTop: 18 }}>
            No owner, no admin, no fee and no upgrade path. They take no ETH and hold no tokens. Roles exist per workspace only. Live on Robinhood Chain with verified source.
          </p>
        </div>
        <Frame className="zf-clist">
          {CONTRACTS.map(([n, d, t]) => (
            <div className="zf-citem" key={n}>
              <b className="zf-break">{n}</b>
              <span>{d}</span>
              <em>{t}</em>
            </div>
          ))}
        </Frame>
      </section>

      <div className="zf-section" style={{ paddingTop: 0 }}>
        <Frame className="zf-cta" as="div">
          <h2 className="zf-h2">
            Prove.
            <span>Verify.</span>
          </h2>
          <p>Start with a bundled circuit. Break it on purpose. Keep the report, with its limits, and let someone else check your work.</p>
          <div className="a">
            <Link href="/docs" className="zf-btn">
              Read the docs
            </Link>
            <Link href="/lab" className="zf-btn solid">
              Open lab <ArrowRight size={15} />
            </Link>
          </div>
        </Frame>
      </div>
    </main>
  );
}
