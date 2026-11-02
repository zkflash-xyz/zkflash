"use client";

import { useState } from "react";
import { BRAND, TOKEN } from "@/config/brand";
import { CheckIcon, CopyIcon } from "@/components/site/Icons";

/* Copy CA: one source (BRAND.ca). Before launch it says "At launch" and copies nothing. */

export function useCopy(value: string) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard refused; the text stays visible.
    }
  };
  return { copied, copy };
}

export function CaRow({ testid = "ca-row" }: { testid?: string }) {
  const { copied, copy } = useCopy(BRAND.ca);
  const live = TOKEN.isLive;
  return (
    <span className="zf-ca" data-testid={testid}>
      <span className="zf-ca-tag">CA</span>
      <code className="zf-ca-val">{live ? BRAND.ca : `${BRAND.symbol} address published at launch`}</code>
      <button type="button" className={`zf-ca-btn${copied ? " done" : ""}`} onClick={copy} disabled={!live} data-testid={`${testid}-copy`} title={live ? "Copy the contract address" : "Published at launch"}>
        {live ? copied ? <CheckIcon size={11} /> : <CopyIcon size={11} /> : null}
        {live ? (copied ? "Copied" : "Copy") : "At launch"}
      </button>
    </span>
  );
}

/** Copy button for a hash or address. */
export function CopyValue({ value, label = "Copy" }: { value: string; label?: string }) {
  const { copied, copy } = useCopy(value);
  return (
    <button type="button" className="zf-copy" onClick={copy} aria-label={label} title={label}>
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
    </button>
  );
}
