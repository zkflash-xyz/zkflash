import Link from "next/link";
import { PageHero } from "@/components/site/Frame";

export default function NotFound() {
  return (
    <main id="main" className="zf-page">
      <PageHero title="Not found" text="This page does not exist. The lab and the docs do." />
      <div className="zf-row" style={{ marginTop: 32 }}>
        <Link href="/lab" className="zf-btn solid">
          Open the lab
        </Link>
        <Link href="/docs" className="zf-btn">
          Read the docs
        </Link>
      </div>
    </main>
  );
}
