import type { Metadata } from "next";
import { CaRow } from "@/components/site/CaCopy";
import { Frame, PageHero } from "@/components/site/Frame";
import { TokenFacts } from "@/components/token/TokenFacts";
import { BRAND, CHAIN, TOKEN } from "@/config/brand";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/token", title: `${BRAND.name} (${BRAND.symbol}) Token`, description: `${BRAND.name} (${BRAND.symbol}) on Robinhood Chain: the contract address, live on-chain facts and what is planned. A community token with no promised value.` });

const PLANNED = [
  ["Hosted test credits", "Pay for test runs on hosted provers instead of your own device."],
  ["Premium reports", "Longer history and richer report formats."],
  ["API services", "Run scenarios from your own tools through a developer API."],
];

export default function Page() {
  return (
    <main id="main" className="zf-page">
      <PageHero title={`${BRAND.symbol}`} text={`The token of ${BRAND.name} on ${CHAIN.name}. Every tool on this site works without it. It carries no promised value, no yield and no claim on anything. Nothing here is financial advice.`} tags={<span className={`zf-tag${TOKEN.isLive ? " on" : ""}`}><i /> {TOKEN.isLive ? "Live" : "Not launched yet"}</span>} />
      <section style={{ marginTop: 40 }}>
        <span className="zf-mono-label">Contract address</span>
        <div style={{ marginTop: 10 }}>
          <CaRow testid="token-ca" />
        </div>
        <p className="zf-lede" style={{ marginTop: 14 }}>
          {TOKEN.isLive ? "This is the only address." : "No address exists yet. Anything offered as one today is not ours."} We post it here and on {BRAND.xHandle}, and we never DM first.
        </p>
      </section>
      <h2 className="zf-h3-big">On chain</h2>
      <Frame style={{ marginTop: 18, padding: 18 }}>
        <TokenFacts />
      </Frame>
      <h2 className="zf-h3-big">Planned utility</h2>
      <p className="zf-lede" style={{ marginTop: 14 }}>
        Potential uses, none of them built. No date is promised.
      </p>
      <div className="zf-lines" data-testid="token-planned">
        {PLANNED.map(([k, v]) => (
          <div className="zf-line" key={k}>
            <div className="min-w-0">
              <strong>{k}</strong>
              <small>{v}</small>
            </div>
            <span />
            <span className="zf-tag planned">Planned</span>
          </div>
        ))}
      </div>
    </main>
  );
}
