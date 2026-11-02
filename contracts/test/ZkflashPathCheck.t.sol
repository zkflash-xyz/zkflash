// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ZkflashPathCheck} from "../src/ZkflashPathCheck.sol";
import {ZkflashRunBook} from "../src/ZkflashRunBook.sol";

/// The generated verifier against a real proof from the Noir circuit (test/fixtures/path_member.json, written by
/// scripts/zk-manifest.mts), alone and through the run book.
contract ZkflashPathCheckTest is Test {
    ZkflashPathCheck verifier;
    bytes proof;
    bytes32[] inputs;

    function setUp() public {
        verifier = new ZkflashPathCheck();
        string memory json = vm.readFile("test/fixtures/path_member.json");
        proof = vm.parseJsonBytes(json, ".proof");
        inputs = vm.parseJsonBytes32Array(json, ".publicInputs");
    }

    function test_realProofVerifies() public {
        uint256 before = gasleft();
        assertTrue(verifier.verify(proof, inputs));
        emit log_named_uint("verify gas", before - gasleft());
        assertEq(inputs.length, 3);
    }

    function test_tamperedPublicInputFails() public {
        inputs[0] = bytes32(uint256(inputs[0]) + 1);
        vm.expectRevert();
        verifier.verify(proof, inputs);
    }

    function test_tamperedScopeFails() public {
        inputs[1] = bytes32(uint256(inputs[1]) + 1);
        vm.expectRevert();
        verifier.verify(proof, inputs);
    }

    function test_tamperedProofByteFails() public {
        bytes memory bad = proof;
        bad[bad.length / 2] ^= 0x01;
        vm.expectRevert();
        verifier.verify(bad, inputs);
    }

    function test_truncatedProofFails() public {
        bytes memory bad = new bytes(proof.length - 32);
        for (uint256 i; i < bad.length; ++i) bad[i] = proof[i];
        vm.expectRevert();
        verifier.verify(bad, inputs);
    }

    function test_wrongInputCountFails() public {
        bytes32[] memory few = new bytes32[](2);
        few[0] = inputs[0];
        few[1] = inputs[1];
        vm.expectRevert();
        verifier.verify(proof, few);
    }

    function test_throughRunBook() public {
        ZkflashRunBook book = new ZkflashRunBook();
        uint64 ws = book.createWorkspace("Lab", false);
        uint64 c = book.registerCircuit(ws, "path_member", keccak256("c"), keccak256("v"), address(verifier), "");
        uint64 id = book.anchorReport(c, keccak256("r"), keccak256("o"), keccak256(proof), 4, 0, "");
        vm.warp(1_800_000_000);
        vm.prank(address(0xB0B));
        book.checkReportProof(id, proof, inputs);
        assertEq(book.getReport(id).proofCheckedAt, 1_800_000_000);

        // A wrong public input is refused and records nothing.
        uint64 second = book.anchorReport(c, keccak256("r2"), keccak256("o"), keccak256(proof), 4, 0, "");
        inputs[2] = bytes32(uint256(inputs[2]) + 1);
        vm.expectRevert(ZkflashRunBook.ProofRejected.selector);
        book.checkReportProof(second, proof, inputs);
        assertEq(book.getReport(second).proofCheckedAt, 0);
    }
}
