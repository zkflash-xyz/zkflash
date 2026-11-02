import Link from "next/link";
import { ASSETS } from "@/config/assets";
import { BRAND, hasGithub } from "@/config/brand";
import { CaRow } from "@/components/site/CaCopy";
import { Frame } from "@/components/site/Frame";
import { ArrowUpRight, XIcon } from "@/components/site/Icons";
import { NAV } from "@/components/site/nav";

export function SiteFooter() {
  return (
    <footer className="zf-footer">
      <Frame className="zf-foot-frame">
        <div className="zf-foot-in">
          <nav className="zf-foot-nav" aria-label="Footer">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}>
                {n.label}
              </Link>
            ))}
            <Link href="/token">Token</Link>
            <a href={BRAND.x} target="_blank" rel="noreferrer">
              <XIcon size={13} /> X
            </a>
            {hasGithub ? (
              <a href={BRAND.github} target="_blank" rel="noreferrer">
                Source <ArrowUpRight size={13} />
              </a>
            ) : null}
          </nav>
          <div className="zf-foot-mid">
            <div className="min-w-0">
              <div className="zf-foot-brand">
                <img src={ASSETS.mark} alt="" width={28} height={28} />
                {BRAND.ticker}
              </div>
              <p>{BRAND.tagline} Timings on this site are measured on your own device and are never a benchmark.</p>
              <div className="zf-foot-ca">
                <CaRow testid="footer-ca" />
                <a className="zf-tag" style={{ height: 34 }} href={BRAND.x} target="_blank" rel="noreferrer">
                  <XIcon size={13} /> {BRAND.xHandle}
                </a>
              </div>
            </div>
            <div className="zf-foot-note">
              <b>Runs on Robinhood Chain</b>
              Contracts can have bugs and transactions cannot be undone. {BRAND.symbol} is a community token with no promised value. Nothing here is financial advice. A verified proof shows only the statement in its circuit. <Link href="/docs#limits">Read the limits</Link>.
            </div>
          </div>
          <div className="zf-foot-base">
            <span>{BRAND.ticker}</span>
            <i />
            <span>{BRAND.xHandle}</span>
            <i />
            <span>© 2026 {BRAND.name}</span>
            <i />
            <span>Robinhood Chain</span>
          </div>
        </div>
      </Frame>
      <Frame className="zf-foot-word" aria-hidden="true">
        Results in view
      </Frame>
    </footer>
  );
}
