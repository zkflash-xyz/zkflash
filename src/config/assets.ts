/*
 * Every brand image path in one place. All of them come from the owner's artwork (2026/november/1/assets/apply-owner-art.mjs).
 * Replace a file under public/brand or src/app and keep its name, or change the path here.
 */
export const ASSETS = {
  /** Mark, transparent. 256x256 (header, footer, wallet, cards). */
  mark: "/brand/mark.webp",
  /** Larger mark (token page). 512x512. */
  markLarge: "/brand/mark-512.webp",
  /** Square avatar / profile picture. 512x512. */
  avatar: "/brand/avatar.webp",
  /** Banner (mark + word + slogan). 1500x500. */
  banner: "/brand/banner.webp",
  /** Owner's mark as a cell grid in the verifier panel. Transparent. 512x512. */
  bolt: "/brand/bolt-grid.webp",
  /** Square PNG served by Next from src/app/icon.png (structured data needs a PNG logo). */
  icon: "/icon.png",
  logoPng: "/icon.png",
  /** Share card served from src/app/opengraph-image.jpg; twitter-image.jpg is the same image. */
  og: "/opengraph-image.jpg",
} as const;
