import type { Metadata } from "next";
import { ReportsDesk } from "@/components/reports/ReportsDesk";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/reports", title: "Verification Reports | zkFlash", description: "zkFlash reports hold results, hashes and limitations. Export JSON or Markdown, anchor the hash on Robinhood Chain, and let a second wallet attest it reproduced them." });

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return <ReportsDesk firstHash={typeof q.hash === "string" ? q.hash : undefined} />;
}
