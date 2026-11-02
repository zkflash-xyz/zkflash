// zkFlash bundled circuit: path member. This is the circuit with an on-chain verifier.
// Statement: a leaf derived from a private secret sits in the depth-8 Poseidon tree with the public
// root, and the public tag was derived from the same secret for the public scope. The tag repeats for
// the same secret and scope, and differs across scopes.
use poseidon::poseidon::bn254::{hash_1, hash_2};

pub global DEPTH: u32 = 8;

fn climb(leaf: Field, siblings: [Field; DEPTH], bits: [Field; DEPTH]) -> Field {
    let mut node = leaf;
    for i in 0..DEPTH {
        let bit = bits[i];
        assert(bit * (1 - bit) == 0, "path bit is not 0 or 1");
        let left = node + bit * (siblings[i] - node);
        let right = siblings[i] + bit * (node - siblings[i]);
        node = hash_2([left, right]);
    }
    node
}

fn main(root: pub Field, scope: pub Field, tag: pub Field, secret: Field, siblings: [Field; DEPTH], bits: [Field; DEPTH]) {
    assert(hash_2([secret, scope]) == tag, "tag does not match this secret and scope");
    assert(climb(hash_1([secret]), siblings, bits) == root, "leaf is not under this root");
}

#[test]
fn single_leaf_path() {
    let secret = 11;
    let mut node = hash_1([secret]);
    let siblings = [0; DEPTH];
    for _ in 0..DEPTH {
        node = hash_2([node, 0]);
    }
    main(node, 5, hash_2([secret, 5]), secret, siblings, [0; DEPTH]);
}

#[test(should_fail_with = "tag does not match")]
fn wrong_scope_fails() {
    let secret = 11;
    let mut node = hash_1([secret]);
    for _ in 0..DEPTH {
        node = hash_2([node, 0]);
    }
    main(node, 6, hash_2([secret, 5]), secret, [0; DEPTH], [0; DEPTH]);
}

#[test(should_fail_with = "path bit")]
fn non_bit_fails() {
    let secret = 11;
    let tag = hash_2([secret, 5]);
    main(0, 5, tag, secret, [0; DEPTH], [2; DEPTH]);
}
