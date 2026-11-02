import type { MetadataRoute } from "next";
import { BRAND } from "@/config/brand";

// Every indexable page.
const ROUTES = ["", "/lab", "/scenarios", "/reports", "/monitor", "/docs", "/token"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((r) => ({ url: `${BRAND.url}${r}`, lastModified: now, changeFrequency: r === "" ? "daily" : "weekly", priority: r === "" ? 1 : 0.6 }));
}
