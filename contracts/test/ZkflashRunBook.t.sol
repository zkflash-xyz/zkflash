// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZkflashRunBook} from "../src/ZkflashRunBook.sol";

contract YesCheck {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return true;
    }
}

contract NoCheck {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        return false;
    }
}

contract RevertCheck {
    function verify(bytes calldata, bytes32[] calldata) external pure returns (bool) {
        revert("no");
    }
}

contract ZkflashRunBookTest is Test {
    ZkflashRunBook book;
    address lead = address(0xA1);
    address runner = address(0xA2);
    address reviewer = address(0xA3);
    address other = address(0xA4);
    address stranger = address(0xA5);

    bytes32 constant CIRCUIT = keccak256("circuit");
    bytes32 constant VK = keccak256("vk");
    bytes32 constant REPORT = keccak256("report");
    bytes32 constant OUTCOMES = keccak256("outcomes");
    bytes constant PROOF = hex"c0ffee";
    uint64 ws;
    uint64 circuit;

    function setUp() public {
        vm.warp(1_800_000_000);
        book = new ZkflashRunBook();
        vm.prank(lead);
        ws = book.createWorkspace("Lab one", false);
        _join(runner, ZkflashRunBook.Role.Runner);
        _join(reviewer, ZkflashRunBook.Role.Reviewer);
        vm.prank(lead);
        circuit = book.registerCircuit(ws, "path_member", CIRCUIT, VK, address(0), "https://zkflash.xyz/zk/path_member.json");
    }

    function _join(address who, ZkflashRunBook.Role role) internal {
        vm.prank(lead);
        book.invite(ws, who, role);
        vm.prank(who);
        book.acceptInvite(ws);
    }

    function _anchor() internal returns (uint64) {
        vm.prank(runner);
        return book.anchorReport(circuit, REPORT, OUTCOMES, keccak256(PROOF), 4, 0, "");
    }

    /* ---------- workspaces ---------- */

    function test_createWorkspace_setsCreatorAsLead() public view {
        ZkflashRunBook.Workspace memory w = book.getWorkspace(ws);
        assertEq(w.creator, lead);
        assertEq(w.leads, 1);
        assertEq(w.members, 3);
        assertEq(w.name, "Lab one");
        assertEq(uint8(book.roleOf(ws, lead)), uint8(ZkflashRunBook.Role.Lead));
    }

    function test_createWorkspace_rejectsBadNames() public {
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace("", false);
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace(" leading", false);
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace("trailing ", false);
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace("line\nbreak", false);
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace(unicode"café", false);
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace("123456789012345678901234567890123", false);
    }

    function test_invite_onlyLead_andNotForMembers() public {
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.invite(ws, stranger, ZkflashRunBook.Role.Runner);
        vm.startPrank(lead);
        vm.expectRevert(ZkflashRunBook.RoleInvalid.selector);
        book.invite(ws, stranger, ZkflashRunBook.Role.None);
        vm.expectRevert(ZkflashRunBook.ZeroValue.selector);
        book.invite(ws, address(0), ZkflashRunBook.Role.Runner);
        vm.expectRevert(ZkflashRunBook.AlreadyMember.selector);
        book.invite(ws, runner, ZkflashRunBook.Role.Reviewer);
        vm.expectRevert(ZkflashRunBook.UnknownWorkspace.selector);
        book.invite(99, stranger, ZkflashRunBook.Role.Runner);
        vm.stopPrank();
    }

    function test_invite_grantsNothingUntilAccepted() public {
        vm.prank(lead);
        book.invite(ws, stranger, ZkflashRunBook.Role.Runner);
        assertEq(uint8(book.roleOf(ws, stranger)), 0);
        vm.prank(stranger);
        vm.expectRevert(ZkflashRunBook.NotARunner.selector);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 1, 0, "");
        vm.prank(stranger);
        book.acceptInvite(ws);
        assertEq(uint8(book.roleOf(ws, stranger)), uint8(ZkflashRunBook.Role.Runner));
        assertEq(uint8(book.inviteOf(ws, stranger)), 0);
    }

    function test_cancelInvite() public {
        vm.prank(lead);
        vm.expectRevert(ZkflashRunBook.NoInvite.selector);
        book.cancelInvite(ws, stranger);
        vm.startPrank(lead);
        book.invite(ws, stranger, ZkflashRunBook.Role.Lead);
        book.cancelInvite(ws, stranger);
        vm.stopPrank();
        vm.prank(stranger);
        vm.expectRevert(ZkflashRunBook.NoInvite.selector);
        book.acceptInvite(ws);
    }

    function test_acceptLeadInvite_countsLead() public {
        vm.prank(lead);
        book.invite(ws, stranger, ZkflashRunBook.Role.Lead);
        vm.prank(stranger);
        book.acceptInvite(ws);
        assertEq(book.getWorkspace(ws).leads, 2);
    }

    function test_lastLead_cannotLeaveOrBeDemoted() public {
        vm.startPrank(lead);
        vm.expectRevert(ZkflashRunBook.LastLead.selector);
        book.removeMember(ws, lead);
        vm.expectRevert(ZkflashRunBook.LastLead.selector);
        book.changeRole(ws, lead, ZkflashRunBook.Role.Runner);
        vm.stopPrank();
    }

    function test_handover_thenFirstLeadCanLeave() public {
        vm.startPrank(lead);
        book.changeRole(ws, runner, ZkflashRunBook.Role.Lead);
        assertEq(book.getWorkspace(ws).leads, 2);
        book.removeMember(ws, lead);
        vm.stopPrank();
        assertEq(book.getWorkspace(ws).leads, 1);
        assertEq(uint8(book.roleOf(ws, lead)), 0);
    }

    function test_changeRole_errors() public {
        vm.startPrank(lead);
        vm.expectRevert(ZkflashRunBook.RoleInvalid.selector);
        book.changeRole(ws, runner, ZkflashRunBook.Role.None);
        vm.expectRevert(ZkflashRunBook.NotAMember.selector);
        book.changeRole(ws, stranger, ZkflashRunBook.Role.Runner);
        vm.stopPrank();
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.changeRole(ws, reviewer, ZkflashRunBook.Role.Lead);
    }

    function test_removeMember_selfAndByLead() public {
        vm.prank(runner);
        book.removeMember(ws, runner);
        assertEq(book.getWorkspace(ws).members, 2);
        vm.prank(reviewer);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.removeMember(ws, lead);
        vm.prank(lead);
        book.removeMember(ws, reviewer);
        assertEq(book.getWorkspace(ws).members, 1);
        vm.prank(lead);
        vm.expectRevert(ZkflashRunBook.NotAMember.selector);
        book.removeMember(ws, reviewer);
    }

    function test_rolesAreIsolatedPerWorkspace() public {
        vm.prank(stranger);
        uint64 second = book.createWorkspace("Lab two", false);
        vm.prank(lead);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.invite(second, other, ZkflashRunBook.Role.Runner);
        vm.prank(stranger);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.invite(ws, other, ZkflashRunBook.Role.Runner);
    }

    /* ---------- circuit registry ---------- */

    function test_registerCircuit_versionsSupersede() public {
        vm.prank(lead);
        uint64 v2 = book.registerCircuit(ws, "path_member", keccak256("c2"), VK, address(0), "");
        ZkflashRunBook.Circuit memory first = book.getCircuit(circuit);
        ZkflashRunBook.Circuit memory second = book.getCircuit(v2);
        assertEq(uint8(first.state), uint8(ZkflashRunBook.CircuitState.Superseded));
        assertEq(uint8(second.state), uint8(ZkflashRunBook.CircuitState.Active));
        assertEq(second.version, 2);
        assertEq(book.latestCircuitOf(ws, keccak256("path_member")), v2);
    }

    function test_registerCircuit_errors() public {
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.registerCircuit(ws, "x", CIRCUIT, VK, address(0), "");
        vm.startPrank(lead);
        vm.expectRevert(ZkflashRunBook.ZeroValue.selector);
        book.registerCircuit(ws, "x", bytes32(0), VK, address(0), "");
        vm.expectRevert(ZkflashRunBook.ZeroValue.selector);
        book.registerCircuit(ws, "x", CIRCUIT, bytes32(0), address(0), "");
        vm.expectRevert(ZkflashRunBook.VerifierHasNoCode.selector);
        book.registerCircuit(ws, "x", CIRCUIT, VK, address(0xdead), "");
        vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.registerCircuit(ws, "", CIRCUIT, VK, address(0), "");
        bytes memory long = new bytes(201);
        vm.expectRevert(ZkflashRunBook.UriTooLong.selector);
        book.registerCircuit(ws, "x", CIRCUIT, VK, address(0), string(long));
        vm.stopPrank();
    }

    function test_retireCircuit_stopsNewReports_andKeepsOldOnes() public {
        uint64 id = _anchor();
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.retireCircuit(circuit);
        vm.prank(lead);
        book.retireCircuit(circuit);
        vm.prank(lead);
        vm.expectRevert(ZkflashRunBook.CircuitAlreadyRetired.selector);
        book.retireCircuit(circuit);
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.CircuitNotActive.selector);
        book.anchorReport(circuit, keccak256("r2"), OUTCOMES, bytes32(0), 1, 0, "");
        vm.prank(stranger);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        assertEq(uint8(book.getReport(id).state), uint8(ZkflashRunBook.ReportState.Reproduced));
    }

    function test_retireCircuit_unknown() public {
        vm.expectRevert(ZkflashRunBook.UnknownCircuit.selector);
        book.retireCircuit(77);
    }

    function test_retiredCircuit_newVersionKeepsRetiredState() public {
        vm.prank(lead);
        book.retireCircuit(circuit);
        vm.prank(lead);
        book.registerCircuit(ws, "path_member", keccak256("c2"), VK, address(0), "");
        assertEq(uint8(book.getCircuit(circuit).state), uint8(ZkflashRunBook.CircuitState.Retired));
    }

    /* ---------- reports ---------- */

    function test_anchor_records() public {
        uint64 id = _anchor();
        ZkflashRunBook.Report memory r = book.getReport(id);
        assertEq(r.author, runner);
        assertEq(r.passed, 4);
        assertEq(r.reportHash, REPORT);
        assertEq(r.anchoredAt, 1_800_000_000);
        assertEq(uint8(r.state), uint8(ZkflashRunBook.ReportState.Anchored));
        assertEq(book.reportIdOf(circuit, REPORT), id);
    }

    function test_anchor_leadMayAnchor_reviewerMayNot() public {
        vm.prank(lead);
        book.anchorReport(circuit, keccak256("l"), OUTCOMES, bytes32(0), 1, 0, "");
        vm.prank(reviewer);
        vm.expectRevert(ZkflashRunBook.NotARunner.selector);
        book.anchorReport(circuit, keccak256("r"), OUTCOMES, bytes32(0), 1, 0, "");
    }

    function test_anchor_errors() public {
        vm.startPrank(runner);
        vm.expectRevert(ZkflashRunBook.UnknownCircuit.selector);
        book.anchorReport(99, REPORT, OUTCOMES, bytes32(0), 1, 0, "");
        vm.expectRevert(ZkflashRunBook.ZeroValue.selector);
        book.anchorReport(circuit, bytes32(0), OUTCOMES, bytes32(0), 1, 0, "");
        vm.expectRevert(ZkflashRunBook.ZeroValue.selector);
        book.anchorReport(circuit, REPORT, bytes32(0), bytes32(0), 1, 0, "");
        vm.expectRevert(ZkflashRunBook.CaseCountInvalid.selector);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 0, 0, "");
        vm.expectRevert(ZkflashRunBook.CaseCountInvalid.selector);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 4096, 1, "");
        bytes memory long = new bytes(201);
        vm.expectRevert(ZkflashRunBook.UriTooLong.selector);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 1, 0, string(long));
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 1, 0, "");
        vm.expectRevert(ZkflashRunBook.ReportAlreadyAnchored.selector);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 1, 0, "");
        vm.stopPrank();
    }

    function test_sameHash_allowedUnderAnotherCircuit() public {
        _anchor();
        vm.prank(lead);
        uint64 c2 = book.registerCircuit(ws, "other", CIRCUIT, VK, address(0), "");
        vm.prank(runner);
        book.anchorReport(c2, REPORT, OUTCOMES, bytes32(0), 1, 0, "");
        assertEq(book.reportCount(), 2);
    }

    /* ---------- attestations and the state machine ---------- */

    function test_attest_authorRejected_oncePerWallet() public {
        uint64 id = _anchor();
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.AuthorCannotAttest.selector);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        vm.prank(other);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        vm.prank(other);
        vm.expectRevert(ZkflashRunBook.AlreadyAttested.selector);
        book.attest(id, ZkflashRunBook.Verdict.NotReproduced, keccak256("x"));
    }

    function test_attest_reproducedNeedsSameOutcomes() public {
        uint64 id = _anchor();
        vm.prank(other);
        vm.expectRevert(ZkflashRunBook.OutcomesDiffer.selector);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, keccak256("different"));
    }

    function test_attest_notReproducedNeedsDifferentHash() public {
        uint64 id = _anchor();
        vm.startPrank(other);
        vm.expectRevert(ZkflashRunBook.VerdictInvalid.selector);
        book.attest(id, ZkflashRunBook.Verdict.NotReproduced, OUTCOMES);
        vm.expectRevert(ZkflashRunBook.VerdictInvalid.selector);
        book.attest(id, ZkflashRunBook.Verdict.NotReproduced, bytes32(0));
        vm.expectRevert(ZkflashRunBook.VerdictInvalid.selector);
        book.attest(id, ZkflashRunBook.Verdict.None, OUTCOMES);
        vm.stopPrank();
    }

    function test_attest_unknownAndWithdrawn() public {
        vm.expectRevert(ZkflashRunBook.UnknownReport.selector);
        book.attest(9, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        uint64 id = _anchor();
        vm.prank(runner);
        book.withdrawReport(id);
        vm.prank(other);
        vm.expectRevert(ZkflashRunBook.ReportNotOpen.selector);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
    }

    function test_stateMachine_reproducedDisputedReproduced() public {
        uint64 id = _anchor();
        vm.prank(other);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        assertEq(uint8(book.getReport(id).state), uint8(ZkflashRunBook.ReportState.Reproduced));
        vm.prank(stranger);
        book.attest(id, ZkflashRunBook.Verdict.NotReproduced, keccak256("x"));
        assertEq(uint8(book.getReport(id).state), uint8(ZkflashRunBook.ReportState.Disputed));
        vm.prank(reviewer);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        ZkflashRunBook.Report memory r = book.getReport(id);
        assertEq(uint8(r.state), uint8(ZkflashRunBook.ReportState.Reproduced));
        assertEq(r.reproduced, 2);
        assertEq(r.reviewerReproduced, 1);
        assertEq(r.notReproduced, 1);
    }

    function test_reviewersOnly_gate() public {
        uint64 id = _anchor();
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.NotALead.selector);
        book.setReviewersOnly(ws, true);
        vm.prank(lead);
        book.setReviewersOnly(ws, true);
        vm.prank(other);
        vm.expectRevert(ZkflashRunBook.NotAllowedToAttest.selector);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        vm.prank(reviewer);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        assertEq(book.getReport(id).reviewerReproduced, 1);
    }

    function test_withdraw_rules() public {
        uint64 id = _anchor();
        vm.prank(other);
        vm.expectRevert(ZkflashRunBook.NotReportAuthor.selector);
        book.withdrawReport(id);
        vm.expectRevert(ZkflashRunBook.UnknownReport.selector);
        book.withdrawReport(50);
        vm.prank(runner);
        book.withdrawReport(id);
        assertEq(uint8(book.getReport(id).state), uint8(ZkflashRunBook.ReportState.Withdrawn));
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.ReportNotOpen.selector);
        book.withdrawReport(id);
        // The hash stays taken after a withdrawal.
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.ReportAlreadyAnchored.selector);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), 1, 0, "");
    }

    function test_withdraw_blockedOnceAttested() public {
        uint64 id = _anchor();
        vm.prank(other);
        book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        vm.prank(runner);
        vm.expectRevert(ZkflashRunBook.ReportHasAttestations.selector);
        book.withdrawReport(id);
    }

    /* ---------- proof check against the named verifier ---------- */

    function _withVerifier(address verifier, bytes32 proofHash) internal returns (uint64) {
        vm.prank(lead);
        uint64 c = book.registerCircuit(ws, "checked", CIRCUIT, VK, verifier, "");
        vm.prank(runner);
        return book.anchorReport(c, keccak256(abi.encode(verifier, proofHash)), OUTCOMES, proofHash, 1, 0, "");
    }

    function test_checkProof_records() public {
        uint64 id = _withVerifier(address(new YesCheck()), keccak256(PROOF));
        vm.warp(1_800_000_100);
        vm.prank(stranger);
        book.checkReportProof(id, PROOF, new bytes32[](1));
        assertEq(book.getReport(id).proofCheckedAt, 1_800_000_100);
    }

    function test_checkProof_rejections() public {
        uint64 noVerifier = _anchor();
        vm.expectRevert(ZkflashRunBook.NoVerifier.selector);
        book.checkReportProof(noVerifier, PROOF, new bytes32[](0));
        vm.expectRevert(ZkflashRunBook.UnknownReport.selector);
        book.checkReportProof(99, PROOF, new bytes32[](0));

        uint64 noHash = _withVerifier(address(new YesCheck()), bytes32(0));
        vm.expectRevert(ZkflashRunBook.NoProofHash.selector);
        book.checkReportProof(noHash, PROOF, new bytes32[](0));

        uint64 yes = _withVerifier(address(new YesCheck()), keccak256(PROOF));
        vm.expectRevert(ZkflashRunBook.ProofDoesNotMatchReport.selector);
        book.checkReportProof(yes, hex"00", new bytes32[](0));
        vm.expectRevert(ZkflashRunBook.ProofTooLarge.selector);
        book.checkReportProof(yes, new bytes(32769), new bytes32[](0));
        vm.expectRevert(ZkflashRunBook.ProofTooLarge.selector);
        book.checkReportProof(yes, PROOF, new bytes32[](33));

        uint64 no = _withVerifier(address(new NoCheck()), keccak256(PROOF));
        vm.expectRevert(ZkflashRunBook.ProofRejected.selector);
        book.checkReportProof(no, PROOF, new bytes32[](0));
        assertEq(book.getReport(no).proofCheckedAt, 0);

        uint64 rev = _withVerifier(address(new RevertCheck()), keccak256(PROOF));
        vm.expectRevert(ZkflashRunBook.ProofRejected.selector);
        book.checkReportProof(rev, PROOF, new bytes32[](0));

        uint64 gone = _withVerifier(address(new YesCheck()), keccak256(hex"aa"));
        vm.prank(runner);
        book.withdrawReport(gone);
        vm.expectRevert(ZkflashRunBook.ReportNotOpen.selector);
        book.checkReportProof(gone, hex"aa", new bytes32[](0));
    }

    /* ---------- no funds ---------- */

    function test_takesNoEth() public {
        (bool ok, ) = address(book).call{value: 1}("");
        assertFalse(ok);
        vm.deal(address(this), 1 ether);
        (ok, ) = address(book).call{value: 1}(abi.encodeWithSelector(book.createWorkspace.selector, "x", false));
        assertFalse(ok);
        assertEq(address(book).balance, 0);
    }

    /* ---------- fuzz ---------- */

    function testFuzz_nameRule(bytes calldata raw) public {
        vm.assume(raw.length <= 40);
        bool ok = raw.length > 0 && raw.length <= 32 && raw[0] != 0x20 && raw[raw.length - 1] != 0x20;
        for (uint256 i; i < raw.length; ++i) if (raw[i] < 0x20 || raw[i] > 0x7e) ok = false;
        if (!ok) vm.expectRevert(ZkflashRunBook.NameInvalid.selector);
        book.createWorkspace(string(raw), false);
    }

    function testFuzz_attestDispute(uint8 yes, uint8 no) public {
        yes = uint8(bound(yes, 0, 20));
        no = uint8(bound(no, 0, 20));
        vm.assume(uint16(yes) + no > 0);
        uint64 id = _anchor();
        for (uint160 i; i < yes; ++i) {
            vm.prank(address(0x1000 + i));
            book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES);
        }
        for (uint160 i; i < no; ++i) {
            vm.prank(address(0x2000 + i));
            book.attest(id, ZkflashRunBook.Verdict.NotReproduced, keccak256("x"));
        }
        ZkflashRunBook.ReportState want = no >= yes ? ZkflashRunBook.ReportState.Disputed : ZkflashRunBook.ReportState.Reproduced;
        assertEq(uint8(book.getReport(id).state), uint8(want));
    }

    function testFuzz_caseBounds(uint16 passed, uint16 failed) public {
        uint256 cases = uint256(passed) + failed;
        if (cases == 0 || cases > 4096) vm.expectRevert(ZkflashRunBook.CaseCountInvalid.selector);
        vm.prank(runner);
        book.anchorReport(circuit, REPORT, OUTCOMES, bytes32(0), passed, failed, "");
    }
}
