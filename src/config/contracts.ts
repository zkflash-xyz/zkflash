import { isAddress } from "@/config/brand";

/*
 * zkFlash contract addresses on Robinhood Chain. Neither needs the $ZKFLASH token, and neither takes constructor arguments.
 *   book      ZkflashRunBook: workspaces, circuit registry, report anchors, attestations.
 *   verifier  ZkflashPathCheck: generated verifier for the path_member circuit.
 * Empty => the book runs in practice mode (kept in this browser, nothing is sent), and the on-chain check says
 * the verifier is not deployed. Proving and local verification never need these.
 * Check a deployment any time: npm run verify-deployment -- --book <address> --book-tx <tx> --verifier <address> --verifier-tx <tx>
 */
const DEPLOYED = {
  book: "0xe89f4d484d494b823b25ca425bcadb34e14da4b8",
  /** Block of the ZkflashRunBook deployment (first block worth reading its events from). */
  bookBlock: 103907278,
  verifier: "0x314204df21ba7c77213d01dc7c6062831d5e3664",
};

/**
 * Local tests only: NEXT_PUBLIC_ZKFLASH_TEST_CONTRACTS='{"book":"0x…","bookBlock":1,"verifier":"0x…"}' at build time
 * points a second build at contracts on an anvil chain. Never set it on Vercel.
 */
function testOverride(): typeof DEPLOYED | null {
  const raw = process.env.NEXT_PUBLIC_ZKFLASH_TEST_CONTRACTS;
  if (!raw) return null;
  try {
    const v = { ...DEPLOYED, ...(JSON.parse(raw) as Partial<typeof DEPLOYED>) };
    return isAddress(v.book) ? v : null;
  } catch {
    return null;
  }
}

export const CONTRACTS = testOverride() ?? DEPLOYED;

export const bookLive = () => isAddress(CONTRACTS.book);
export const verifierLive = () => isAddress(CONTRACTS.verifier);

export const CONTRACT_NAMES = { book: "ZkflashRunBook", verifier: "ZkflashPathCheck" } as const;
