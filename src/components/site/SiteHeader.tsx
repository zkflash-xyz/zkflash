"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ASSETS } from "@/config/assets";
import { BRAND, CHAIN } from "@/config/brand";
import { CloseIcon, MenuIcon, XIcon } from "@/components/site/Icons";
import { NAV } from "@/components/site/nav";
import { NavWallet } from "@/components/wallet/WalletButton";

export function SiteHeader() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const current = (href: string) => (path === href || path.startsWith(`${href}/`) ? "page" : undefined);
  return (
    <>
      <a href="#main" className="zf-skip">
        Skip to content
      </a>
      <header className="zf-header">
        <div className="zf-header-in">
          <Link href="/" className="zf-brand" aria-label={`${BRAND.name} home`}>
            <img src={ASSETS.mark} alt="" width={28} height={28} />
            <span>{BRAND.ticker}</span>
          </Link>
          <nav className="zf-nav" aria-label="Main">
            <ul>
              {NAV.map((n) => (
                <li key={n.href}>
                  <Link href={n.href} aria-current={current(n.href)}>
                    {n.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <div className="zf-head-right">
            <span className="zf-chainpill">
              <span className="zf-dot" aria-hidden="true" />
              {CHAIN.name}
            </span>
            <a className="zf-iconbtn zf-xlink" href={BRAND.x} target="_blank" rel="noreferrer" aria-label={`${BRAND.name} on X`}>
              <XIcon size={15} />
            </a>
            <NavWallet />
            <button type="button" className="zf-iconbtn zf-burger" aria-expanded={open} aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((v) => !v)} data-testid="burger">
              {open ? <CloseIcon size={16} /> : <MenuIcon size={16} />}
            </button>
          </div>
        </div>
      </header>
      {open ? (
        <div className="zf-drawer" data-testid="drawer">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={current(n.href)} onClick={() => setOpen(false)}>
              {n.label}
            </Link>
          ))}
          <Link href="/token" onClick={() => setOpen(false)}>
            Token
          </Link>
          <a href={BRAND.x} target="_blank" rel="noreferrer">
            X
          </a>
        </div>
      ) : null}
    </>
  );
}
