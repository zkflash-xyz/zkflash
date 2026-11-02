// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZkflashRunBook} from "../src/ZkflashRunBook.sol";

/// Random valid and invalid calls from a small set of wallets on one workspace.
contract BookDriver is Test {
    ZkflashRunBook public book;
    uint64 public ws;
    uint64 public circuit;
    bytes32 public constant OUTCOMES = keccak256("outcomes");
    address[] public wallets;
    uint256 public ghostMembers = 1;
    uint256 public anchored;

    constructor(ZkflashRunBook book_) {
        book = book_;
        for (uint160 i = 1; i <= 6; i++) wallets.push(address(i * 0x1111));
        vm.prank(wallets[0]);
        ws = book.createWorkspace("Driver", false);
        vm.prank(wallets[0]);
        circuit = book.registerCircuit(ws, "c", keccak256("c"), keccak256("v"), address(0), "");
    }

    function _w(uint256 s) internal view returns (address) {
        return wallets[s % wallets.length];
    }

    function invite(uint256 a, uint256 b, uint8 role) external {
        role = uint8(bound(role, 1, 3));
        vm.prank(_w(a));
        try book.invite(ws, _w(b), ZkflashRunBook.Role(role)) {} catch {}
    }

    function accept(uint256 a) external {
        vm.prank(_w(a));
        try book.acceptInvite(ws) {
            ghostMembers++;
        } catch {}
    }

    function remove(uint256 a, uint256 b) external {
        vm.prank(_w(a));
        try book.removeMember(ws, _w(b)) {
            ghostMembers--;
        } catch {}
    }

    function change(uint256 a, uint256 b, uint8 role) external {
        role = uint8(bound(role, 1, 3));
        vm.prank(_w(a));
        try book.changeRole(ws, _w(b), ZkflashRunBook.Role(role)) {} catch {}
    }

    function anchor(uint256 a, bytes32 hash) external {
        vm.prank(_w(a));
        try book.anchorReport(circuit, hash, OUTCOMES, bytes32(0), 1, 0, "") {
            anchored++;
        } catch {}
    }

    function attest(uint256 a, uint64 id, bool yes) external {
        id = uint64(bound(id, 1, 20));
        vm.prank(_w(a));
        if (yes) {
            try book.attest(id, ZkflashRunBook.Verdict.Reproduced, OUTCOMES) {} catch {}
        } else {
            try book.attest(id, ZkflashRunBook.Verdict.NotReproduced, keccak256("x")) {} catch {}
        }
    }

    function withdraw(uint256 a, uint64 id) external {
        id = uint64(bound(id, 1, 20));
        vm.prank(_w(a));
        try book.withdrawReport(id) {} catch {}
    }

    function walletCount() external view returns (uint256) {
        return wallets.length;
    }
}

contract ZkflashRunBookInvariantTest is Test {
    ZkflashRunBook book;
    BookDriver driver;

    function setUp() public {
        book = new ZkflashRunBook();
        driver = new BookDriver(book);
        targetContract(address(driver));
    }

    function invariant_alwaysOneLead() public view {
        uint64 ws = driver.ws();
        ZkflashRunBook.Workspace memory w = book.getWorkspace(ws);
        assertGe(w.leads, 1);
        uint256 leads;
        uint256 members;
        for (uint256 i; i < driver.walletCount(); ++i) {
            ZkflashRunBook.Role r = book.roleOf(ws, driver.wallets(i));
            if (r == ZkflashRunBook.Role.Lead) leads++;
            if (r != ZkflashRunBook.Role.None) members++;
        }
        assertEq(w.leads, leads);
        assertEq(w.members, members);
        assertEq(w.members, driver.ghostMembers());
    }

    function invariant_stateFollowsCounts() public view {
        for (uint64 id = 1; id <= book.reportCount(); ++id) {
            ZkflashRunBook.Report memory r = book.getReport(id);
            if (r.state == ZkflashRunBook.ReportState.Anchored || r.state == ZkflashRunBook.ReportState.Withdrawn) {
                assertEq(uint256(r.reproduced) + r.notReproduced, 0);
            } else if (r.state == ZkflashRunBook.ReportState.Reproduced) {
                assertGt(r.reproduced, r.notReproduced);
            } else {
                assertEq(uint8(r.state), uint8(ZkflashRunBook.ReportState.Disputed));
                assertGe(r.notReproduced, r.reproduced);
            }
            assertEq(book.verdictOf(id, r.author) == ZkflashRunBook.Verdict.None, true);
        }
    }

    function invariant_holdsNoFunds() public view {
        assertEq(address(book).balance, 0);
    }

    function invariant_reportCountMatches() public view {
        assertEq(book.reportCount(), driver.anchored());
    }
}
