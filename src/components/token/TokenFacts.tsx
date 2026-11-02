"use client";

import { useChain } from "@/components/providers/ChainProvider";
import { BRAND, LAUNCHPAD, TOKEN, buyUrl, chartUrl } from "@/config/brand";
import { fmtSupply, usd } from "@/lib/format";

/** Token facts read on chain (after launch) plus public market data; before launch every slot says so. */
export function TokenFacts() {
  const { facts } = useChain();
  const live = TOKEN.isLive;
  const t = facts?.token;
  const m = facts?.market;
  const items = [
    { k: "Name / symbol", v: live ? (t?.name && t?.symbol ? `${t.name} / ${t.symbol}` : "—") : "At launch" },
    { k: "Total supply", v: live ? fmtSupply(t?.supply ?? null, t?.decimals ?? null) : "At launch" },
    { k: "Price", v: live ? usd(m?.priceUsd ?? null, 8) : "—" },
    { k: "Liquidity", v: live ? usd(m?.liquidityUsd ?? null, 0) : "—" },
    { k: "ETH / USD", v: usd(facts?.ethUsd ?? null) },
    { k: "Chain block", v: facts?.block ? facts.block.toLocaleString("en-US") : "—" },
  ];
  const chart = chartUrl(BRAND.ca);
  return (
    <>
      <dl className="zf-grid-stats m-0" data-testid="token-facts">
        {items.map((i) => (
          <div key={i.k}>
            <dt>{i.k}</dt>
            <dd>{i.v}</dd>
          </div>
        ))}
      </dl>
      <div className="zf-row zf-pad-t">
        <a href={buyUrl()} target="_blank" rel="noreferrer" className="zf-btn solid" data-testid="buy">
          {live ? `Buy on ${LAUNCHPAD.name}` : `${LAUNCHPAD.name} launchpad · at launch`}
        </a>
        {TOKEN.explorerUrl ? (
          <a href={TOKEN.explorerUrl} target="_blank" rel="noreferrer" className="zf-btn">
            Explorer
          </a>
        ) : null}
        {chart ? (
          <a href={chart} target="_blank" rel="noreferrer" className="zf-btn">
            Chart on DEXTools
          </a>
        ) : null}
      </div>
    </>
  );
}
