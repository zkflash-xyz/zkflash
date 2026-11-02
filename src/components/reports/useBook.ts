"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocalStore } from "@/components/wallet/useLocalStore";
import { useWalletModal } from "@/components/wallet/WalletButton";
import { useWallet } from "@/components/wallet/WalletProvider";
import { bookLive, CONTRACTS } from "@/config/contracts";
import { storageKey } from "@/config/storage";
import { ERROR_WORDS } from "@/lib/abi";
import { BookError, EMPTY_PRACTICE, EMPTY_VIEW, practiceApply, practiceView, type Action, type BookView, type PracticeState } from "@/lib/book";
import { encodeAction, readBook } from "@/lib/book-chain";
import { explain, waitForReceipt } from "@/lib/client";

export const PRACTICE_WALLETS = { A: "0x000000000000000000000000000000000000a11c", B: "0x000000000000000000000000000000000000b0b0" } as const;

/**
 * The run book behind one interface. Deployed: reads chain state and sends transactions through the connected wallet.
 * Not deployed: the practice engine with two practice wallets, kept in this browser. Nothing is sent.
 */
export function useBook() {
  const live = bookLive();
  const { address, onRobinhoodChain, sendTransaction, switchNetwork } = useWallet();
  const { open } = useWalletModal();
  const [practice, setPractice] = useLocalStore<PracticeState>(storageKey("practice-book"), EMPTY_PRACTICE);
  const [who, setWho] = useLocalStore<"A" | "B">(storageKey("practice-wallet"), "A");
  const [chainView, setChainView] = useState<BookView>(EMPTY_VIEW);
  const [loading, setLoading] = useState(live);
  const [readError, setReadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTx, setLastTx] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!live) return;
    try {
      setChainView(await readBook(address));
      setReadError(null);
    } catch (e) {
      setReadError(explain(e));
    } finally {
      setLoading(false);
    }
  }, [live, address]);

  useEffect(() => {
    if (!live) return;
    // Reads chain state when the page opens or the wallet changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    const t = window.setInterval(() => document.visibilityState === "visible" && refresh(), 20_000);
    return () => window.clearInterval(t);
  }, [live, refresh]);

  const view = useMemo(() => (live ? chainView : practiceView(practice, PRACTICE_WALLETS[who])), [live, chainView, practice, who]);
  const me = live ? address : PRACTICE_WALLETS[who];

  const exec = useCallback(
    async (action: Action): Promise<boolean> => {
      setError(null);
      setLastTx(null);
      if (!live) {
        try {
          setPractice(practiceApply(practice, action, PRACTICE_WALLETS[who], Math.floor(Date.now() / 1000)));
          return true;
        } catch (e) {
          setError(e instanceof BookError ? (ERROR_WORDS[e.code] ?? e.code) : String(e));
          return false;
        }
      }
      if (!address) {
        open();
        return false;
      }
      if (!onRobinhoodChain) {
        await switchNetwork();
        return false;
      }
      setBusy(true);
      try {
        const hash = await sendTransaction({ to: CONTRACTS.book, data: encodeAction(action) });
        setLastTx(hash);
        const r = await waitForReceipt(hash, 180_000);
        if (!r.ok) throw new Error("The transaction reverted.");
        await refresh();
        return true;
      } catch (e) {
        setError(explain(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [live, practice, setPractice, who, address, onRobinhoodChain, open, switchNetwork, sendTransaction, refresh],
  );

  const reset = useCallback(() => setPractice(EMPTY_PRACTICE), [setPractice]);
  return { live, view, me, who, setWho, exec, busy, error, setError, lastTx, loading, readError, reset, refresh };
}
export type BookApi = ReturnType<typeof useBook>;
