// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice The one function this book needs from a proof verifier.
interface IZkflashProofCheck {
    function verify(bytes calldata proof, bytes32[] calldata publicInputs) external view returns (bool);
}

/// @title ZkflashRunBook
/// @notice A public record of proof test runs. Workspaces register circuits, runners anchor the hash of a
///         report, another wallet can attest that it reproduced the outcomes, and anyone can have the report's
///         proof checked by the verifier the circuit names.
/// @dev No owner, no admin, no fee, no upgrade. It takes no ETH and holds no tokens. Roles exist per workspace
///      only. A report hash says what was published, not that its contents are true: timings and outcomes are
///      self-reported, and the only thing this contract checks itself is a proof against the named verifier.
///      Time is block.timestamp. Readers take L2 block numbers from the event logs, because block.number on this
///      chain returns the L1 number.
contract ZkflashRunBook {
    enum Role {
        None,
        Lead,
        Runner,
        Reviewer
    }

    enum CircuitState {
        None,
        Active,
        Superseded,
        Retired
    }

    enum ReportState {
        None,
        Anchored,
        Reproduced,
        Disputed,
        Withdrawn
    }

    enum Verdict {
        None,
        Reproduced,
        NotReproduced
    }

    struct Workspace {
        address creator;
        uint64 createdAt;
        uint32 leads;
        uint32 members;
        bool reviewersOnly;
        string name;
    }

    struct Circuit {
        uint64 workspaceId;
        uint32 version;
        CircuitState state;
        uint64 registeredAt;
        address registrar;
        address verifier;
        bytes32 familyHash;
        bytes32 circuitHash;
        bytes32 vkHash;
    }

    struct Report {
        uint64 circuitId;
        uint64 anchoredAt;
        uint64 proofCheckedAt;
        ReportState state;
        address author;
        uint16 passed;
        uint16 failed;
        uint16 reproduced;
        uint16 notReproduced;
        uint16 reviewerReproduced;
        bytes32 reportHash;
        bytes32 outcomesHash;
        bytes32 proofHash;
    }

    uint256 public constant MAX_NAME = 32;
    uint256 public constant MAX_URI = 200;
    uint256 public constant MAX_CASES = 4096;
    uint256 public constant MAX_PROOF_BYTES = 32768;
    uint256 public constant MAX_PUBLIC_INPUTS = 32;

    uint64 public workspaceCount;
    uint64 public circuitCount;
    uint64 public reportCount;

    mapping(uint64 => Workspace) private _workspaces;
    mapping(uint64 => Circuit) private _circuits;
    mapping(uint64 => Report) private _reports;

    /// @notice Current role of a wallet in a workspace.
    mapping(uint64 => mapping(address => Role)) public roleOf;
    /// @notice Role a wallet was invited to and has not accepted yet.
    mapping(uint64 => mapping(address => Role)) public inviteOf;
    /// @notice Latest circuit id of a family (workspace + circuit name). Zero when there is none.
    mapping(uint64 => mapping(bytes32 => uint64)) public latestCircuitOf;
    /// @notice Report id of a report hash under a circuit. Zero when it was not anchored.
    mapping(uint64 => mapping(bytes32 => uint64)) public reportIdOf;
    /// @notice What a wallet attested for a report.
    mapping(uint64 => mapping(address => Verdict)) public verdictOf;

    event WorkspaceCreated(uint64 indexed workspaceId, address indexed creator, string name, bool reviewersOnly);
    event PolicyChanged(uint64 indexed workspaceId, address indexed by, bool reviewersOnly);
    event MemberInvited(uint64 indexed workspaceId, address indexed who, address indexed by, Role role);
    event InviteCancelled(uint64 indexed workspaceId, address indexed who, address indexed by);
    event RoleChanged(uint64 indexed workspaceId, address indexed who, address indexed by, Role role);
    event CircuitRegistered(
        uint64 indexed circuitId,
        uint64 indexed workspaceId,
        bytes32 indexed familyHash,
        uint32 version,
        bytes32 circuitHash,
        bytes32 vkHash,
        address verifier,
        string name,
        string uri
    );
    event CircuitStateChanged(uint64 indexed circuitId, address indexed by, CircuitState state);
    event ReportAnchored(
        uint64 indexed reportId,
        uint64 indexed circuitId,
        address indexed author,
        bytes32 reportHash,
        bytes32 outcomesHash,
        bytes32 proofHash,
        uint16 passed,
        uint16 failed,
        string uri
    );
    event ReportAttested(uint64 indexed reportId, address indexed attester, Verdict verdict, bool fromReviewer, bytes32 resultHash);
    event ReportStateChanged(uint64 indexed reportId, ReportState state);
    event ProofChecked(uint64 indexed reportId, address indexed caller, address indexed verifier, bytes32 publicInputsHash);

    error NameInvalid();
    error UriTooLong();
    error UnknownWorkspace();
    error UnknownCircuit();
    error UnknownReport();
    error NotALead();
    error NotARunner();
    error NotAllowedToAttest();
    error RoleInvalid();
    error AlreadyMember();
    error NoInvite();
    error NotAMember();
    error LastLead();
    error ZeroValue();
    error VerifierHasNoCode();
    error CircuitNotActive();
    error CircuitAlreadyRetired();
    error CaseCountInvalid();
    error ReportAlreadyAnchored();
    error ReportNotOpen();
    error NotReportAuthor();
    error ReportHasAttestations();
    error AuthorCannotAttest();
    error AlreadyAttested();
    error VerdictInvalid();
    error OutcomesDiffer();
    error NoVerifier();
    error NoProofHash();
    error ProofDoesNotMatchReport();
    error ProofTooLarge();
    error ProofRejected();

    /* ---------------------------------------------------------- workspaces */

    /// @notice Opens a workspace. The caller becomes its first lead.
    function createWorkspace(string calldata name, bool reviewersOnly) external returns (uint64 workspaceId) {
        _checkName(name);
        workspaceId = ++workspaceCount;
        _workspaces[workspaceId] = Workspace({
            creator: msg.sender,
            createdAt: uint64(block.timestamp),
            leads: 1,
            members: 1,
            reviewersOnly: reviewersOnly,
            name: name
        });
        roleOf[workspaceId][msg.sender] = Role.Lead;
        emit WorkspaceCreated(workspaceId, msg.sender, name, reviewersOnly);
        emit RoleChanged(workspaceId, msg.sender, msg.sender, Role.Lead);
    }

    /// @notice Chooses who may attest reports of this workspace: any other wallet, or reviewers and leads only.
    function setReviewersOnly(uint64 workspaceId, bool reviewersOnly) external {
        _onlyLead(workspaceId);
        _workspaces[workspaceId].reviewersOnly = reviewersOnly;
        emit PolicyChanged(workspaceId, msg.sender, reviewersOnly);
    }

    /// @notice Invites a wallet. Nothing changes for it until it accepts.
    function invite(uint64 workspaceId, address who, Role role) external {
        _onlyLead(workspaceId);
        if (role == Role.None) revert RoleInvalid();
        if (who == address(0)) revert ZeroValue();
        if (roleOf[workspaceId][who] != Role.None) revert AlreadyMember();
        inviteOf[workspaceId][who] = role;
        emit MemberInvited(workspaceId, who, msg.sender, role);
    }

    function cancelInvite(uint64 workspaceId, address who) external {
        _onlyLead(workspaceId);
        if (inviteOf[workspaceId][who] == Role.None) revert NoInvite();
        delete inviteOf[workspaceId][who];
        emit InviteCancelled(workspaceId, who, msg.sender);
    }

    function acceptInvite(uint64 workspaceId) external {
        Role role = inviteOf[workspaceId][msg.sender];
        if (role == Role.None) revert NoInvite();
        delete inviteOf[workspaceId][msg.sender];
        Workspace storage w = _workspaces[workspaceId];
        w.members += 1;
        if (role == Role.Lead) w.leads += 1;
        roleOf[workspaceId][msg.sender] = role;
        emit RoleChanged(workspaceId, msg.sender, msg.sender, role);
    }

    /// @notice A lead changes the role of a member. A workspace always keeps at least one lead.
    function changeRole(uint64 workspaceId, address who, Role role) external {
        _onlyLead(workspaceId);
        if (role == Role.None) revert RoleInvalid();
        Role current = roleOf[workspaceId][who];
        if (current == Role.None) revert NotAMember();
        Workspace storage w = _workspaces[workspaceId];
        if (current == Role.Lead && role != Role.Lead) {
            if (w.leads == 1) revert LastLead();
            w.leads -= 1;
        } else if (current != Role.Lead && role == Role.Lead) {
            w.leads += 1;
        }
        roleOf[workspaceId][who] = role;
        emit RoleChanged(workspaceId, who, msg.sender, role);
    }

    /// @notice Removes a member. Leads may remove anyone; anyone may remove themselves.
    function removeMember(uint64 workspaceId, address who) external {
        if (who != msg.sender) _onlyLead(workspaceId);
        Role current = roleOf[workspaceId][who];
        if (current == Role.None) revert NotAMember();
        Workspace storage w = _workspaces[workspaceId];
        if (current == Role.Lead) {
            if (w.leads == 1) revert LastLead();
            w.leads -= 1;
        }
        w.members -= 1;
        delete roleOf[workspaceId][who];
        emit RoleChanged(workspaceId, who, msg.sender, Role.None);
    }

    /* ---------------------------------------------------------- circuit registry */

    /// @notice Registers a circuit, or a new version of one with the same name. The previous version is superseded.
    /// @param verifier Contract that can check this circuit's proofs, or the zero address when there is none.
    function registerCircuit(
        uint64 workspaceId,
        string calldata name,
        bytes32 circuitHash,
        bytes32 vkHash,
        address verifier,
        string calldata uri
    ) external returns (uint64 circuitId) {
        _onlyLead(workspaceId);
        _checkName(name);
        if (bytes(uri).length > MAX_URI) revert UriTooLong();
        if (circuitHash == bytes32(0) || vkHash == bytes32(0)) revert ZeroValue();
        if (verifier != address(0) && verifier.code.length == 0) revert VerifierHasNoCode();

        circuitId = _writeCircuit(workspaceId, keccak256(bytes(name)), circuitHash, vkHash, verifier);
        _emitRegistered(circuitId, name, uri);
    }

    /// @notice Stops new reports for a circuit. Existing reports stay readable and can still be attested.
    function retireCircuit(uint64 circuitId) external {
        Circuit storage c = _circuits[circuitId];
        if (c.state == CircuitState.None) revert UnknownCircuit();
        _onlyLead(c.workspaceId);
        if (c.state == CircuitState.Retired) revert CircuitAlreadyRetired();
        c.state = CircuitState.Retired;
        emit CircuitStateChanged(circuitId, msg.sender, CircuitState.Retired);
    }

    /* ---------------------------------------------------------- reports */

    /// @notice Anchors the hash of a report against an active circuit.
    /// @param reportHash Hash of the whole report, timings included.
    /// @param outcomesHash Hash of the deterministic part only: circuit, cases, expected and actual results.
    /// @param proofHash keccak256 of the proof the report carries, or zero when it carries none.
    function anchorReport(
        uint64 circuitId,
        bytes32 reportHash,
        bytes32 outcomesHash,
        bytes32 proofHash,
        uint16 passed,
        uint16 failed,
        string calldata uri
    ) external returns (uint64 reportId) {
        _checkAnchor(circuitId, reportHash, outcomesHash, uint256(passed) + failed, bytes(uri).length);
        reportId = ++reportCount;
        Report storage r = _reports[reportId];
        r.circuitId = circuitId;
        r.anchoredAt = uint64(block.timestamp);
        r.state = ReportState.Anchored;
        r.author = msg.sender;
        r.passed = passed;
        r.failed = failed;
        r.reportHash = reportHash;
        r.outcomesHash = outcomesHash;
        r.proofHash = proofHash;
        reportIdOf[circuitId][reportHash] = reportId;
        _emitAnchored(reportId, uri);
    }

    /// @notice Attest a report from a second wallet. "Reproduced" must carry the same outcomes hash as the report,
    ///         which the contract compares. "Not reproduced" carries the attester's own different hash.
    function attest(uint64 reportId, Verdict verdict, bytes32 resultHash) external {
        Report storage r = _reports[reportId];
        if (r.state == ReportState.None) revert UnknownReport();
        if (r.state == ReportState.Withdrawn) revert ReportNotOpen();
        if (msg.sender == r.author) revert AuthorCannotAttest();
        if (verdictOf[reportId][msg.sender] != Verdict.None) revert AlreadyAttested();

        uint64 workspaceId = _circuits[r.circuitId].workspaceId;
        Role role = roleOf[workspaceId][msg.sender];
        bool fromReviewer = role == Role.Reviewer || role == Role.Lead;
        if (_workspaces[workspaceId].reviewersOnly && !fromReviewer) revert NotAllowedToAttest();

        if (verdict == Verdict.Reproduced) {
            if (resultHash != r.outcomesHash) revert OutcomesDiffer();
            r.reproduced += 1;
            if (fromReviewer) r.reviewerReproduced += 1;
        } else if (verdict == Verdict.NotReproduced) {
            if (resultHash == bytes32(0) || resultHash == r.outcomesHash) revert VerdictInvalid();
            r.notReproduced += 1;
        } else {
            revert VerdictInvalid();
        }
        verdictOf[reportId][msg.sender] = verdict;
        emit ReportAttested(reportId, msg.sender, verdict, fromReviewer, resultHash);

        // Disagreement stays visible: the report reads as disputed until reproductions outnumber it.
        ReportState next = r.notReproduced >= r.reproduced ? ReportState.Disputed : ReportState.Reproduced;
        if (next != r.state) {
            r.state = next;
            emit ReportStateChanged(reportId, next);
        }
    }

    /// @notice The author takes a report back while nobody has attested it. The hash stays taken, so it cannot be
    ///         anchored again under the same circuit.
    function withdrawReport(uint64 reportId) external {
        Report storage r = _reports[reportId];
        if (r.state == ReportState.None) revert UnknownReport();
        if (msg.sender != r.author) revert NotReportAuthor();
        if (r.state == ReportState.Withdrawn) revert ReportNotOpen();
        if (r.reproduced != 0 || r.notReproduced != 0) revert ReportHasAttestations();
        r.state = ReportState.Withdrawn;
        emit ReportStateChanged(reportId, ReportState.Withdrawn);
    }

    /// @notice Runs the report's proof through the verifier its circuit names, inside this transaction, and records
    ///         the time when it passes. Anyone can call it. The verifier is chosen by the workspace, so read which
    ///         address it is before relying on the result.
    function checkReportProof(uint64 reportId, bytes calldata proof, bytes32[] calldata publicInputs) external {
        Report storage r = _reports[reportId];
        if (r.state == ReportState.None) revert UnknownReport();
        if (r.state == ReportState.Withdrawn) revert ReportNotOpen();
        if (r.proofHash == bytes32(0)) revert NoProofHash();
        address verifier = _circuits[r.circuitId].verifier;
        if (verifier == address(0)) revert NoVerifier();
        if (proof.length > MAX_PROOF_BYTES || publicInputs.length > MAX_PUBLIC_INPUTS) revert ProofTooLarge();
        if (keccak256(proof) != r.proofHash) revert ProofDoesNotMatchReport();

        // The interface call is a static call, so the verifier cannot re-enter and change state.
        try IZkflashProofCheck(verifier).verify(proof, publicInputs) returns (bool ok) {
            if (!ok) revert ProofRejected();
        } catch {
            revert ProofRejected();
        }
        r.proofCheckedAt = uint64(block.timestamp);
        emit ProofChecked(reportId, msg.sender, verifier, keccak256(abi.encodePacked(publicInputs)));
    }

    /* ---------------------------------------------------------- views */

    function getWorkspace(uint64 workspaceId) external view returns (Workspace memory) {
        return _workspaces[workspaceId];
    }

    function getCircuit(uint64 circuitId) external view returns (Circuit memory) {
        return _circuits[circuitId];
    }

    function getReport(uint64 reportId) external view returns (Report memory) {
        return _reports[reportId];
    }

    /* ---------------------------------------------------------- internal */

    function _onlyLead(uint64 workspaceId) private view {
        if (_workspaces[workspaceId].creator == address(0)) revert UnknownWorkspace();
        if (roleOf[workspaceId][msg.sender] != Role.Lead) revert NotALead();
    }

    function _writeCircuit(uint64 workspaceId, bytes32 familyHash, bytes32 circuitHash, bytes32 vkHash, address verifier) private returns (uint64 circuitId) {
        uint64 previous = latestCircuitOf[workspaceId][familyHash];
        uint32 version = 1;
        if (previous != 0) {
            Circuit storage p = _circuits[previous];
            version = p.version + 1;
            if (p.state == CircuitState.Active) {
                p.state = CircuitState.Superseded;
                emit CircuitStateChanged(previous, msg.sender, CircuitState.Superseded);
            }
        }
        circuitId = ++circuitCount;
        _circuits[circuitId] = Circuit({
            workspaceId: workspaceId,
            version: version,
            state: CircuitState.Active,
            registeredAt: uint64(block.timestamp),
            registrar: msg.sender,
            verifier: verifier,
            familyHash: familyHash,
            circuitHash: circuitHash,
            vkHash: vkHash
        });
        latestCircuitOf[workspaceId][familyHash] = circuitId;
    }

    function _emitRegistered(uint64 circuitId, string calldata name, string calldata uri) private {
        Circuit storage c = _circuits[circuitId];
        emit CircuitRegistered(circuitId, c.workspaceId, c.familyHash, c.version, c.circuitHash, c.vkHash, c.verifier, name, uri);
    }

    function _emitAnchored(uint64 reportId, string calldata uri) private {
        Report storage r = _reports[reportId];
        emit ReportAnchored(reportId, r.circuitId, r.author, r.reportHash, r.outcomesHash, r.proofHash, r.passed, r.failed, uri);
    }

    function _checkAnchor(uint64 circuitId, bytes32 reportHash, bytes32 outcomesHash, uint256 cases, uint256 uriLength) private view {
        Circuit storage c = _circuits[circuitId];
        if (c.state == CircuitState.None) revert UnknownCircuit();
        if (c.state != CircuitState.Active) revert CircuitNotActive();
        Role role = roleOf[c.workspaceId][msg.sender];
        if (role != Role.Lead && role != Role.Runner) revert NotARunner();
        if (reportHash == bytes32(0) || outcomesHash == bytes32(0)) revert ZeroValue();
        if (cases == 0 || cases > MAX_CASES) revert CaseCountInvalid();
        if (uriLength > MAX_URI) revert UriTooLong();
        if (reportIdOf[circuitId][reportHash] != 0) revert ReportAlreadyAnchored();
    }

    /// @dev 1 to 32 printable ASCII characters, no leading or trailing space.
    function _checkName(string calldata name) private pure {
        bytes calldata b = bytes(name);
        if (b.length == 0 || b.length > MAX_NAME) revert NameInvalid();
        if (b[0] == 0x20 || b[b.length - 1] == 0x20) revert NameInvalid();
        for (uint256 i; i < b.length; ++i) {
            if (b[i] < 0x20 || b[i] > 0x7e) revert NameInvalid();
        }
    }
}
