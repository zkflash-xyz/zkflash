import { decodeEventLog, encodeFunctionData, type Abi } from "viem";
import { CONTRACTS } from "@/config/contracts";
import { BOOK_ABI, VERIFIER_ABI } from "@/lib/abi";
import { encodeRead, read, readMany, rpcCall, type Read } from "@/lib/client";
import { BOOK_TOPICS } from "@/lib/relay";
import { CIRCUIT_IDS } from "@/lib/zk/core";
import { MANIFEST } from "@/lib/zk/facts";
import { EMPTY_VIEW, ZERO_ADDRESS, toCall, type Action, type BookView, type CircuitView, type ReportView, type WorkspaceView } from "@/lib/book";

/* Reads and call data for the deployed run book. Lists show the newest entries; everything is read from chain state. */

const LIST = 30;
const bundledName = (hash: string) => CIRCUIT_IDS.find((id) => MANIFEST[id].circuitHash === hash.toLowerCase());
const book = (fn: string, args: readonly unknown[] = []): Read => ({ to: CONTRACTS.book, abi: BOOK_ABI, fn, args });
const ids = (count: number) => Array.from({ length: Math.min(count, LIST) }, (_, i) => count - i);

export function encodeAction(a: Action): `0x${string}` {
  const { fn, args } = toCall(a);
  return encodeFunctionData({ abi: BOOK_ABI as Abi, functionName: fn, args } as never);
}

export async function readBook(wallet: string | null): Promise<BookView> {
  const [w, c, r] = (await readMany([book("workspaceCount"), book("circuitCount"), book("reportCount")])) as (bigint | null)[];
  if (w === null || c === null || r === null) throw new Error("The run book could not be read.");
  const wIds = ids(Number(w));
  const cIds = ids(Number(c));
  const rIds = ids(Number(r));
  const raw = await readMany([...wIds.map((id) => book("getWorkspace", [BigInt(id)])), ...cIds.map((id) => book("getCircuit", [BigInt(id)])), ...rIds.map((id) => book("getReport", [BigInt(id)]))]);
  const wRaw = raw.slice(0, wIds.length) as (Record<string, never> | null)[];
  const cRaw = raw.slice(wIds.length, wIds.length + cIds.length) as (Record<string, never> | null)[];
  const rRaw = raw.slice(wIds.length + cIds.length) as (Record<string, never> | null)[];
  const me = wallet ?? ZERO_ADDRESS;
  const mine = await readMany([...wIds.map((id) => book("roleOf", [BigInt(id), me])), ...wIds.map((id) => book("inviteOf", [BigInt(id), me])), ...rIds.map((id) => book("verdictOf", [BigInt(id), me]))]);

  const workspaces: WorkspaceView[] = wIds.flatMap((id, i) => {
    const x = wRaw[i] as null | { creator: string; createdAt: bigint; leads: number; members: number; reviewersOnly: boolean; name: string };
    return x ? [{ id, creator: x.creator, createdAt: Number(x.createdAt), leads: Number(x.leads), members: Number(x.members), reviewersOnly: x.reviewersOnly, name: x.name, myRole: Number(mine[i] ?? 0), myInvite: Number(mine[wIds.length + i] ?? 0) }] : [];
  });
  const names = await circuitNames(cIds);
  const circuits: CircuitView[] = cIds.flatMap((id, i) => {
    const x = cRaw[i] as null | { workspaceId: bigint; version: number; state: number; registeredAt: bigint; registrar: string; verifier: string; familyHash: string; circuitHash: string; vkHash: string };
    return x ? [{ id, workspaceId: Number(x.workspaceId), version: Number(x.version), state: Number(x.state), registeredAt: Number(x.registeredAt), registrar: x.registrar, verifier: x.verifier, familyHash: x.familyHash, circuitHash: x.circuitHash, vkHash: x.vkHash, name: names.get(id) ?? bundledName(x.circuitHash) ?? `Circuit ${id}` }] : [];
  });
  const reports: ReportView[] = rIds.flatMap((id, i) => {
    const x = rRaw[i] as null | { circuitId: bigint; anchoredAt: bigint; proofCheckedAt: bigint; state: number; author: string; passed: number; failed: number; reproduced: number; notReproduced: number; reviewerReproduced: number; reportHash: string; outcomesHash: string; proofHash: string };
    return x
      ? [
          {
            id,
            circuitId: Number(x.circuitId),
            anchoredAt: Number(x.anchoredAt),
            proofCheckedAt: Number(x.proofCheckedAt),
            state: Number(x.state),
            author: x.author,
            passed: Number(x.passed),
            failed: Number(x.failed),
            reproduced: Number(x.reproduced),
            notReproduced: Number(x.notReproduced),
            reviewerReproduced: Number(x.reviewerReproduced),
            reportHash: x.reportHash,
            outcomesHash: x.outcomesHash,
            proofHash: x.proofHash,
            myVerdict: Number(mine[wIds.length * 2 + i] ?? 0),
          },
        ]
      : [];
  });
  return { ...EMPTY_VIEW, workspaces, circuits, reports, totals: { workspaces: Number(w), circuits: Number(c), reports: Number(r) } };
}

export type BookEvent = { name: string; block: number; tx: string; args: Record<string, unknown> };

/** Newest run book events, decoded. Stays inside the relay's block range cap. */
export async function recentEvents(span = 19_000): Promise<BookEvent[]> {
  const latest = Number(BigInt(await rpcCall<string>("eth_blockNumber", [])));
  const from = Math.max(CONTRACTS.bookBlock, latest - span);
  const logs = await rpcCall<{ topics: `0x${string}`[]; data: `0x${string}`; blockNumber: string; transactionHash: string }[]>("eth_getLogs", [
    { address: CONTRACTS.book, fromBlock: `0x${from.toString(16)}`, toBlock: `0x${latest.toString(16)}`, topics: [BOOK_TOPICS] },
  ]);
  return logs
    .flatMap((l) => {
      try {
        const d = decodeEventLog({ abi: BOOK_ABI, data: l.data, topics: l.topics as [`0x${string}`] }) as unknown as { eventName: string; args?: Record<string, unknown> };
        return [{ name: d.eventName as string, block: Number(BigInt(l.blockNumber)), tx: l.transactionHash, args: d.args ?? {} }];
      } catch {
        return [];
      }
    })
    .reverse();
}

/** Circuit names live in the registration event only. Missing ones show a plain label. */
async function circuitNames(wanted: number[]): Promise<Map<number, string>> {
  const out = new Map<number, string>();
  if (wanted.length === 0) return out;
  const events = await recentEvents().catch(() => []);
  for (const e of events) if (e.name === "CircuitRegistered") out.set(Number(e.args.circuitId), String(e.args.name));
  return out;
}

/** eth_call against the deployed verifier. A revert counts as rejected; it never spends gas. */
export async function verifyOnChain(proof: string, publicInputs: string[]): Promise<{ valid: boolean; detail: string | null }> {
  const r: Read = { to: CONTRACTS.verifier, abi: VERIFIER_ABI as Abi, fn: "verify", args: [proof, publicInputs] };
  try {
    const raw = await rpcCall<`0x${string}`>("eth_call", [{ to: r.to, data: encodeRead(r) }, "latest"]);
    return { valid: BigInt(raw) === 1n, detail: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/could not be reached|not served|busy|Too many/i.test(message)) throw error;
    return { valid: false, detail: message.slice(0, 200) };
  }
}

export { read };
