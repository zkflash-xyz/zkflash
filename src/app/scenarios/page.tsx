import type { Metadata } from "next";
import { ScenarioBuilder } from "@/components/lab/ScenarioBuilder";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/scenarios", title: "Test Scenarios | zkFlash", description: "Build zkFlash test cases: valid, invalid, tampered public input and tampered proof byte, with real proofs and expected against actual results for each." });

export default function Page() {
  return <ScenarioBuilder />;
}
