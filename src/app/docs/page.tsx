import type { Metadata } from "next";
import { JsonLd } from "@/components/JsonLd";
import { PageHero } from "@/components/site/Frame";
import { BRAND, CHAIN, explorerAddress, isAddress } from "@/config/brand";
import { CONTRACTS } from "@/config/contracts";
import { FAQ } from "@/content/faq";
import { VERIFY_GAS } from "@/content/measured";
import { CIRCUIT_IDS, CIRCUITS } from "@/lib/zk/core";
import { MANIFEST } from "@/lib/zk/facts";
import { faqLd, pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/docs", title: "Docs | zkFlash", description: "How zkFlash generates, tests and verifies Noir proofs, what each circuit states, how reports and the run book work, and what none of it can tell you." });

const NAV = [
  { h: "Start", items: [["overview", "The short version"]] },
  { h: "Proof lab", items: [["circuits", "Bundled circuits"], ["generate", "Generating a proof"], ["verify", "Verification engine"]] },
  { h: "Testing", items: [["scenarios", "Test scenarios"], ["timing", "Timeline and monitor"]] },
  { h: "Reports", items: [["reports", "Report files"], ["runbook", "The run book"]] },
  { h: "Limits", items: [["limits", "What this does not show"], ["planned", "Planned, not built"]] },
  { h: "Reference", items: [["deployments", "Deployments"], ["token", "Token"], ["faq", "Questions"]] },
];

function Deployed({ name, role, address }: { name: string; role: string; address: string }) {
  return (
    <div>
      <b>{name}</b>
      <span>{role}</span>
      <span>
        {isAddress(address) ? (
          <a href={explorerAddress(address)} target="_blank" rel="noreferrer" style={{ textDecoration: "underline" }}>
            {address}
          </a>
        ) : (
          "Not deployed yet"
        )}
      </span>
    </div>
  );
}

export default function Page() {
  return (
    <main id="main" className="zf-page">
      <JsonLd data={faqLd(FAQ)} />
      <PageHero
        title="Docs"
        text="How the lab, the scenarios and the reports work, what each one shows, and what exists only as a plan."
        tags={
          <>
            <span className="zf-tag">
              <i /> Local run
            </span>
            <span className="zf-tag on">
              <i /> Anchored report
            </span>
          </>
        }
      />
      <div className="zf-docs">
        <nav className="zf-docnav" aria-label="Docs">
          {NAV.map((g) => (
            <div key={g.h}>
              <b>{g.h}</b>
              <ul>
                {g.items.map(([id, label]) => (
                  <li key={id}>
                    <a href={`#${id}`}>{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <article className="zf-prose min-w-0">
          <h2 id="overview">The short version</h2>
          <p>
            {BRAND.name} helps developers building with zero-knowledge proofs see the whole cycle of a test: whether a proof is valid, how long each step took on their machine, which public inputs it used, and why a test failed. The focus is understanding the cycle, not only producing a proof.
          </p>
          <p>Everything labelled as a result on this site came from a real circuit, a real witness and a real verifier. There are no mock proofs and no stored sample timings.</p>
          <div className="zf-callout">A proof shows the statement written in its circuit and nothing more. Your wallet address, IP address and transaction activity stay visible whenever you touch a chain.</div>

          <h2 id="circuits">Bundled circuits</h2>
          <p>Four Noir circuits are compiled in advance and served by this site. Uploading your own is planned, not built.</p>
          <ul className="dots">
            {CIRCUIT_IDS.map((id) => (
              <li key={id}>
                <strong>{id}</strong> ({MANIFEST[id].gates?.toLocaleString("en-US")} gates, {MANIFEST[id].proofBytes.toLocaleString("en-US")} byte proof). {CIRCUITS[id].statement} It does not prove: {CIRCUITS[id].doesNotProve.toLowerCase()}
              </li>
            ))}
          </ul>

          <h2 id="generate">Generating a proof</h2>
          <p>Pick a circuit in the lab and press Generate. A Web Worker loads the compiled circuit, the WASM and the public setup points from this site, solves the witness with noir_js and generates an UltraHonk proof with Barretenberg on one thread. The page keeps responding while it works.</p>
          <p>The setup points are the public Aztec Ignition ceremony values, cut to the first 2^17 points. Your inputs are not sent anywhere. Even so, these circuits are test material: do not type real secrets into them.</p>

          <h2 id="verify">Verification engine</h2>
          <p>
            Two checks exist. The local check runs the verifier in your browser with the circuit&apos;s key and works for all four circuits. The on-chain check sends the same proof and public inputs to <code>ZkflashPathCheck</code> through an <code>eth_call</code>, for the <code>path_member</code> circuit only. A call costs no gas and sends no transaction. In a Foundry test, one check used {VERIFY_GAS}.
          </p>
          <p>The inspector also lets your browser derive the verification key hash itself and compares it with the one in the bundle.</p>

          <h2 id="scenarios">Test scenarios</h2>
          <p>Each case states its expected outcome before it runs. There are four kinds, and three possible outcomes: verified, witness rejected, or verification rejected.</p>
          <ul className="dots">
            <li><strong>Valid.</strong> A true statement. The proof must verify.</li>
            <li><strong>Invalid.</strong> A false statement. The circuit must refuse to produce a witness, so no proof exists.</li>
            <li><strong>Tampered public input.</strong> A valid proof, then one public input is raised by one. Verification must fail.</li>
            <li><strong>Tampered proof byte.</strong> A valid proof, then one bit of one byte is flipped. Verification must fail.</li>
          </ul>
          <p>You can add your own cases with other values, another byte position and any expected outcome. A case whose result differs from what you wrote is shown as differing, and that is often the useful part.</p>

          <h2 id="timing">Timeline and monitor</h2>
          <p>The timeline splits a run into preparation, witness, proving and verification. The monitor collects your runs per stage and per circuit, and stores them only in this browser. The first run of a session includes loading WASM in its preparation stage.</p>
          <div className="zf-callout">These are single measurements on one browser and device. They are not benchmarks, and we make no claim about how fast anything is.</div>

          <h2 id="reports">Report files</h2>
          <p>A report holds the circuit hash, verification key hash, environment, cases with expected and actual results, stage timings, the first valid proof with its hash, and a list of limitations. Export it as JSON or Markdown. Private inputs are not in it.</p>
          <p>
            Two hashes matter. The <strong>report hash</strong> covers the whole canonical JSON, so it changes with every run, since proofs are randomised and clocks differ. The <strong>outcomes hash</strong> covers only circuit, cases, expected and actual results, so two machines that see the same behaviour get the same one. Anyone can upload a report file and have both hashes recomputed in their browser.
          </p>

          <h2 id="runbook">The run book</h2>
          <p>
            <code>ZkflashRunBook</code> is a public record with no owner, admin, fee or upgrade path. It takes no ETH and holds no tokens. Before it is deployed, the Reports page runs the same rules as a labelled practice mode in your browser.
          </p>
          <ul className="dots">
            <li><strong>Workspaces.</strong> Anyone can open one. Roles are per workspace: lead, runner, reviewer. An invite does nothing until accepted, and a workspace always keeps a lead.</li>
            <li><strong>Circuit registry.</strong> Leads register a circuit hash, key hash and optional verifier. A new version supersedes the last. Retired circuits take no new reports.</li>
            <li><strong>Anchors.</strong> Leads and runners anchor a report hash, outcomes hash, proof hash and case counts. The author can withdraw only while nobody has attested it.</li>
            <li><strong>Attestations.</strong> Any wallet other than the author, or only reviewers and leads if the workspace says so, can attest once. &quot;Reproduced&quot; must carry the same outcomes hash, which the contract compares. &quot;Not reproduced&quot; carries a different hash. A report reads as disputed until reproductions outnumber disagreements.</li>
            <li><strong>Proof check.</strong> Anyone can run a report&apos;s proof through the verifier its circuit names, inside a transaction. The workspace chose that verifier, so check which address it is.</li>
          </ul>

          <h2 id="limits">What this does not show</h2>
          <ul className="dots">
            <li>A verified proof does not show that inputs are true in the world, or who the prover is.</li>
            <li>An anchor shows when a hash was published. It does not show that the report is correct: results are self-reported.</li>
            <li>An attestation counts a wallet. One person can hold many wallets.</li>
            <li>Timings do not carry over to other devices.</li>
            <li>The bundled circuits have had no outside review. Do not use them to protect value.</li>
            <li>Passing these cases does not show a circuit is sound. It shows these cases came out this way.</li>
          </ul>

          <h2 id="planned">Planned, not built</h2>
          <ul className="dots">
            <li>Custom circuit upload.</li>
            <li>Developer SDK and API.</li>
            <li>Hosted test runs, premium reports and {BRAND.symbol} credits.</li>
          </ul>
          <p>None of these exist today, and no date is promised.</p>

          <h2 id="deployments">Deployments</h2>
          <p>{CHAIN.name} ({CHAIN.id}). Check any address yourself with <code>npm run verify-deployment</code> from the source.</p>
          <div className="zf-depl">
            <Deployed name="ZkflashRunBook" role="Workspaces, circuit registry, report anchors, attestations" address={CONTRACTS.book} />
            <Deployed name="ZkflashPathCheck" role="Verifier generated from path_member. Links ZkflashSpongeTape and ZkflashGateChecks." address={CONTRACTS.verifier} />
          </div>

          <h2 id="token">Token</h2>
          <p>
            {BRAND.symbol} is a community token on {CHAIN.name} with no promised value. The studio does not need it. Its possible uses (hosted test credits, premium reports, API access) are planned, not built. See the <a href="/token" style={{ textDecoration: "underline" }}>token page</a>.
          </p>

          <h2 id="faq">Questions</h2>
          {FAQ.map((f) => (
            <div key={f.q}>
              <p>
                <strong>{f.q}</strong>
              </p>
              <p style={{ marginTop: 6 }}>{f.a}</p>
            </div>
          ))}
        </article>
      </div>
    </main>
  );
}
