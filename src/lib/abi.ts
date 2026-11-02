import { parseAbi } from "viem";
import ART from "@/lib/contracts/artifacts.json";
import type { Abi } from "viem";

/* Contract interfaces the site uses. The run book ABI comes straight from the generated artifact. */

export const BOOK_ABI = ART.contracts.ZkflashRunBook.abi as Abi;
export const VERIFIER_ABI = parseAbi(["function verify(bytes proof, bytes32[] publicInputs) view returns (bool)"]);
export const FEED_ABI = parseAbi(["function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)"]);
export const ERC20_ABI = parseAbi(["function name() view returns (string)", "function symbol() view returns (string)", "function decimals() view returns (uint8)", "function totalSupply() view returns (uint256)"]);

/** Every custom error the site can meet, for decoding reverts. */
export const ALL_ERRORS = [...(ART.contracts.ZkflashRunBook.abi as Abi).filter((x) => x.type === "error"), ...(ART.contracts.ZkflashPathCheck.abi as Abi).filter((x) => x.type === "error")];

/** Plain words for the run book's errors. */
export const ERROR_WORDS: Record<string, string> = {
  NameInvalid: "Names are 1 to 32 printable ASCII characters with no space at either end.",
  UriTooLong: "The link is longer than 200 characters.",
  UnknownWorkspace: "That workspace does not exist.",
  UnknownCircuit: "That circuit is not registered.",
  UnknownReport: "That report does not exist.",
  NotALead: "Only a lead of this workspace can do that.",
  NotARunner: "Only a lead or a runner of this workspace can anchor reports.",
  NotAllowedToAttest: "This workspace takes attestations from its reviewers and leads only.",
  RoleInvalid: "Choose a role.",
  AlreadyMember: "That wallet is already a member.",
  NoInvite: "There is no open invite for that wallet.",
  NotAMember: "That wallet is not a member.",
  LastLead: "A workspace must keep at least one lead.",
  ZeroValue: "A required value is empty.",
  VerifierHasNoCode: "The verifier address has no code on this chain.",
  CircuitNotActive: "This circuit was superseded or retired, so it takes no new reports.",
  CircuitAlreadyRetired: "This circuit is already retired.",
  CaseCountInvalid: "A report needs between 1 and 4096 cases.",
  ReportAlreadyAnchored: "This exact report hash is already anchored under this circuit.",
  ReportNotOpen: "This report was withdrawn.",
  NotReportAuthor: "Only the wallet that anchored a report can withdraw it.",
  ReportHasAttestations: "A report with attestations cannot be withdrawn.",
  AuthorCannotAttest: "The wallet that anchored a report cannot attest it. Use a second wallet.",
  AlreadyAttested: "This wallet already attested this report.",
  VerdictInvalid: "A 'not reproduced' attestation needs a hash that differs from the report's.",
  OutcomesDiffer: "Your outcomes hash differs from the report's, so this is not a reproduction.",
  NoVerifier: "This circuit names no verifier contract.",
  NoProofHash: "This report carries no proof.",
  ProofDoesNotMatchReport: "This proof is not the one the report names.",
  ProofTooLarge: "The proof or its public inputs are over the size limit.",
  ProofRejected: "The verifier rejected this proof.",
};
