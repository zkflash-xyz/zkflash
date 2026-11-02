import type { Metadata } from "next";
import { MonitorView } from "@/components/monitor/MonitorView";
import { pageMeta } from "@/lib/seo";

export const metadata: Metadata = pageMeta({ path: "/monitor", title: "Performance Monitor | zkFlash", description: "zkFlash shows proving and verification times measured in your own browser, per circuit and per stage. Your device, your numbers, and never a benchmark claim." });

export default function Page() {
  return <MonitorView />;
}
