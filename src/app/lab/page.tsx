import type { Metadata } from "next";
import { LabWorkspace } from "@/components/lab/LabWorkspace";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/lab", title: "Proof Lab | zkFlash", description: "The zkFlash lab generates real Noir proofs in your browser, times each stage on your device and checks the result locally or against an on-chain verifier." });

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const q = await searchParams;
  return <LabWorkspace firstCircuit={one(q.circuit)} firstTab={one(q.tab)} />;
}
