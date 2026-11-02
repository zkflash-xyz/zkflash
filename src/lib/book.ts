/*
 * The run book as the site sees it: plain views, the actions a user can take, and a practice engine.
 * Before the contract is deployed the practice engine applies the same rules to a copy kept in this browser, and
 * raises the same error names. contracts/src/ZkflashRunBook.sol remains the source of truth; book.test.ts mirrors its rules.
 */
export type Hex = `0x${string}`;
export const ROLE = ["None", "Lead", "Runner", "Reviewer"] as const;
export type RoleName = (typeof ROLE)[number];
export const CIRCUIT_STATE = ["None", "Active", "Superseded", "Retired"] as const;
export const REPORT_STATE = ["None", "Anchored", "Reproduced", "Disputed", "Withdrawn"] as const;
export const VERDICT = ["None", "Reproduced", "NotReproduced"] as const;

export type WorkspaceView = { id: number; creator: string; createdAt: number; leads: number; members: number; reviewersOnly: boolean; name: string; myRole: number; myInvite: number };
export type CircuitView = { id: number; workspaceId: number; version: number; state: number; registeredAt: number; registrar: string; verifier: string; familyHash: string; circuitHash: string; vkHash: string; name: string };
export type ReportView = {
  id: number;
  circuitId: number;
  anchoredAt: number;
  proofCheckedAt: number;
  state: number;
  author: string;
  passed: number;
  failed: number;
  reproduced: number;
  notReproduced: number;
  reviewerReproduced: number;
  reportHash: string;
  outcomesHash: string;
  proofHash: string;
  myVerdict: number;
};
export type BookView = { workspaces: WorkspaceView[]; circuits: CircuitView[]; reports: ReportView[]; totals: { workspaces: number; circuits: number; reports: number } };
export const EMPTY_VIEW: BookView = { workspaces: [], circuits: [], reports: [], totals: { workspaces: 0, circuits: 0, reports: 0 } };

export type Action =
  | { kind: "createWorkspace"; name: string; reviewersOnly: boolean }
  | { kind: "setReviewersOnly"; workspaceId: number; reviewersOnly: boolean }
  | { kind: "invite"; workspaceId: number; who: string; role: number }
  | { kind: "cancelInvite"; workspaceId: number; who: string }
  | { kind: "acceptInvite"; workspaceId: number }
  | { kind: "changeRole"; workspaceId: number; who: string; role: number }
  | { kind: "removeMember"; workspaceId: number; who: string }
  | { kind: "registerCircuit"; workspaceId: number; name: string; circuitHash: string; vkHash: string; verifier: string; uri: string }
  | { kind: "retireCircuit"; circuitId: number }
  | { kind: "anchorReport"; circuitId: number; reportHash: string; outcomesHash: string; proofHash: string; passed: number; failed: number; uri: string }
  | { kind: "attest"; reportId: number; verdict: number; resultHash: string }
  | { kind: "withdrawReport"; reportId: number }
  | { kind: "checkReportProof"; reportId: number; proof: string; publicInputs: string[] };

/** How the contract is called for each action: function name and arguments. */
export function toCall(a: Action): { fn: string; args: unknown[] } {
  switch (a.kind) {
    case "createWorkspace":
      return { fn: a.kind, args: [a.name, a.reviewersOnly] };
    case "setReviewersOnly":
      return { fn: a.kind, args: [BigInt(a.workspaceId), a.reviewersOnly] };
    case "invite":
    case "changeRole":
      return { fn: a.kind, args: [BigInt(a.workspaceId), a.who, a.role] };
    case "cancelInvite":
    case "removeMember":
      return { fn: a.kind, args: [BigInt(a.workspaceId), a.who] };
    case "acceptInvite":
      return { fn: a.kind, args: [BigInt(a.workspaceId)] };
    case "registerCircuit":
      return { fn: a.kind, args: [BigInt(a.workspaceId), a.name, a.circuitHash, a.vkHash, a.verifier || ZERO_ADDRESS, a.uri] };
    case "retireCircuit":
      return { fn: a.kind, args: [BigInt(a.circuitId)] };
    case "anchorReport":
      return { fn: a.kind, args: [BigInt(a.circuitId), a.reportHash, a.outcomesHash, a.proofHash || ZERO_HASH, a.passed, a.failed, a.uri] };
    case "attest":
      return { fn: a.kind, args: [BigInt(a.reportId), a.verdict, a.resultHash] };
    case "withdrawReport":
      return { fn: a.kind, args: [BigInt(a.reportId)] };
    case "checkReportProof":
      return { fn: a.kind, args: [BigInt(a.reportId), a.proof, a.publicInputs] };
  }
}

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
export const ZERO_HASH = `0x${"00".repeat(32)}`;

/* ---------- practice engine ---------- */

export type PracticeState = {
  now: number;
  workspaces: Omit<WorkspaceView, "myRole" | "myInvite">[];
  circuits: CircuitView[];
  reports: Omit<ReportView, "myVerdict">[];
  roles: Record<string, number>;
  invites: Record<string, number>;
  verdicts: Record<string, number>;
};

export const EMPTY_PRACTICE: PracticeState = { now: 0, workspaces: [], circuits: [], reports: [], roles: {}, invites: {}, verdicts: {} };

export class BookError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
const no = (code: string): never => {
  throw new BookError(code);
};
const key = (a: number, who: string) => `${a}:${who.toLowerCase()}`;

function checkName(name: string) {
  if (name.length === 0 || name.length > 32 || name[0] === " " || name[name.length - 1] === " " || !/^[\x20-\x7e]+$/.test(name)) no("NameInvalid");
}

/** Applies an action for `from` to a copy of the state. Throws BookError with the contract's error name. */
export function practiceApply(state: PracticeState, a: Action, from: string, now: number): PracticeState {
  const s: PracticeState = JSON.parse(JSON.stringify(state));
  s.now = now;
  const ws = (id: number) => s.workspaces.find((w) => w.id === id);
  const onlyLead = (id: number) => {
    if (!ws(id)) no("UnknownWorkspace");
    if (s.roles[key(id, from)] !== 1) no("NotALead");
  };
  const role = (id: number, who: string) => s.roles[key(id, who)] ?? 0;
  switch (a.kind) {
    case "createWorkspace": {
      checkName(a.name);
      const id = s.workspaces.length + 1;
      s.workspaces.push({ id, creator: from, createdAt: now, leads: 1, members: 1, reviewersOnly: a.reviewersOnly, name: a.name });
      s.roles[key(id, from)] = 1;
      return s;
    }
    case "setReviewersOnly":
      onlyLead(a.workspaceId);
      ws(a.workspaceId)!.reviewersOnly = a.reviewersOnly;
      return s;
    case "invite":
      onlyLead(a.workspaceId);
      if (a.role === 0) no("RoleInvalid");
      if (/^0x0{40}$/.test(a.who)) no("ZeroValue");
      if (role(a.workspaceId, a.who) !== 0) no("AlreadyMember");
      s.invites[key(a.workspaceId, a.who)] = a.role;
      return s;
    case "cancelInvite":
      onlyLead(a.workspaceId);
      if (!s.invites[key(a.workspaceId, a.who)]) no("NoInvite");
      delete s.invites[key(a.workspaceId, a.who)];
      return s;
    case "acceptInvite": {
      const r = s.invites[key(a.workspaceId, from)];
      if (!r) no("NoInvite");
      delete s.invites[key(a.workspaceId, from)];
      const w = ws(a.workspaceId)!;
      w.members += 1;
      if (r === 1) w.leads += 1;
      s.roles[key(a.workspaceId, from)] = r;
      return s;
    }
    case "changeRole": {
      onlyLead(a.workspaceId);
      if (a.role === 0) no("RoleInvalid");
      const current = role(a.workspaceId, a.who);
      if (current === 0) no("NotAMember");
      const w = ws(a.workspaceId)!;
      if (current === 1 && a.role !== 1) {
        if (w.leads === 1) no("LastLead");
        w.leads -= 1;
      } else if (current !== 1 && a.role === 1) w.leads += 1;
      s.roles[key(a.workspaceId, a.who)] = a.role;
      return s;
    }
    case "removeMember": {
      if (a.who.toLowerCase() !== from.toLowerCase()) onlyLead(a.workspaceId);
      const current = role(a.workspaceId, a.who);
      if (current === 0) no("NotAMember");
      const w = ws(a.workspaceId)!;
      if (current === 1) {
        if (w.leads === 1) no("LastLead");
        w.leads -= 1;
      }
      w.members -= 1;
      delete s.roles[key(a.workspaceId, a.who)];
      return s;
    }
    case "registerCircuit": {
      onlyLead(a.workspaceId);
      checkName(a.name);
      if (a.uri.length > 200) no("UriTooLong");
      if (!a.circuitHash || !a.vkHash || a.circuitHash === ZERO_HASH || a.vkHash === ZERO_HASH) no("ZeroValue");
      const earlier = s.circuits.filter((c) => c.workspaceId === a.workspaceId && c.name === a.name);
      const previous = earlier[earlier.length - 1];
      if (previous?.state === 1) previous.state = 2;
      s.circuits.push({ id: s.circuits.length + 1, workspaceId: a.workspaceId, version: previous ? previous.version + 1 : 1, state: 1, registeredAt: now, registrar: from, verifier: a.verifier || ZERO_ADDRESS, familyHash: a.name, circuitHash: a.circuitHash, vkHash: a.vkHash, name: a.name });
      return s;
    }
    case "retireCircuit": {
      const c = s.circuits.find((x) => x.id === a.circuitId);
      if (!c) return no("UnknownCircuit");
      onlyLead(c.workspaceId);
      if (c.state === 3) no("CircuitAlreadyRetired");
      c.state = 3;
      return s;
    }
    case "anchorReport": {
      const c = s.circuits.find((x) => x.id === a.circuitId);
      if (!c) return no("UnknownCircuit");
      if (c.state !== 1) no("CircuitNotActive");
      const r = role(c.workspaceId, from);
      if (r !== 1 && r !== 2) no("NotARunner");
      if (!a.reportHash || !a.outcomesHash) no("ZeroValue");
      const cases = a.passed + a.failed;
      if (cases === 0 || cases > 4096) no("CaseCountInvalid");
      if (a.uri.length > 200) no("UriTooLong");
      if (s.reports.some((x) => x.circuitId === a.circuitId && x.reportHash === a.reportHash)) no("ReportAlreadyAnchored");
      s.reports.push({ id: s.reports.length + 1, circuitId: a.circuitId, anchoredAt: now, proofCheckedAt: 0, state: 1, author: from, passed: a.passed, failed: a.failed, reproduced: 0, notReproduced: 0, reviewerReproduced: 0, reportHash: a.reportHash, outcomesHash: a.outcomesHash, proofHash: a.proofHash || ZERO_HASH });
      return s;
    }
    case "attest": {
      const r = s.reports.find((x) => x.id === a.reportId);
      if (!r) return no("UnknownReport");
      if (r.state === 4) no("ReportNotOpen");
      if (r.author.toLowerCase() === from.toLowerCase()) no("AuthorCannotAttest");
      if (s.verdicts[key(a.reportId, from)]) no("AlreadyAttested");
      const wsId = s.circuits.find((c) => c.id === r.circuitId)!.workspaceId;
      const my = role(wsId, from);
      const fromReviewer = my === 3 || my === 1;
      if (ws(wsId)!.reviewersOnly && !fromReviewer) no("NotAllowedToAttest");
      if (a.verdict === 1) {
        if (a.resultHash !== r.outcomesHash) no("OutcomesDiffer");
        r.reproduced += 1;
        if (fromReviewer) r.reviewerReproduced += 1;
      } else if (a.verdict === 2) {
        if (!a.resultHash || a.resultHash === ZERO_HASH || a.resultHash === r.outcomesHash) no("VerdictInvalid");
        r.notReproduced += 1;
      } else no("VerdictInvalid");
      s.verdicts[key(a.reportId, from)] = a.verdict;
      r.state = r.notReproduced >= r.reproduced ? 3 : 2;
      return s;
    }
    case "withdrawReport": {
      const r = s.reports.find((x) => x.id === a.reportId);
      if (!r) return no("UnknownReport");
      if (r.author.toLowerCase() !== from.toLowerCase()) no("NotReportAuthor");
      if (r.state === 4) no("ReportNotOpen");
      if (r.reproduced !== 0 || r.notReproduced !== 0) no("ReportHasAttestations");
      r.state = 4;
      return s;
    }
    case "checkReportProof": {
      const r = s.reports.find((x) => x.id === a.reportId);
      if (!r) return no("UnknownReport");
      if (r.state === 4) no("ReportNotOpen");
      if (!r.proofHash || r.proofHash === ZERO_HASH) no("NoProofHash");
      // The site runs the local verifier first in practice mode; only a passing proof reaches this line.
      r.proofCheckedAt = now;
      return s;
    }
  }
}

/** The practice state as the same view the chain produces, for one wallet. */
export function practiceView(s: PracticeState, wallet: string): BookView {
  return {
    workspaces: [...s.workspaces].reverse().map((w) => ({ ...w, myRole: s.roles[key(w.id, wallet)] ?? 0, myInvite: s.invites[key(w.id, wallet)] ?? 0 })),
    circuits: [...s.circuits].reverse(),
    reports: [...s.reports].reverse().map((r) => ({ ...r, myVerdict: s.verdicts[key(r.id, wallet)] ?? 0 })),
    totals: { workspaces: s.workspaces.length, circuits: s.circuits.length, reports: s.reports.length },
  };
}

export function reportStateLabel(state: number) {
  return ["—", "Anchored", "Reproduced", "Disputed", "Withdrawn"][state] ?? "—";
}
