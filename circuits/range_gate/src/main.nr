// zkFlash bundled circuit: range gate.
// Statement: the value behind a public commitment lies inside the public bounds [low, high].
// The commitment binds the prover to one value; the salt keeps small values from being guessed.
use poseidon::poseidon::bn254::hash_2;

fn main(commitment: pub Field, low: pub u64, high: pub u64, value: u64, salt: Field) {
    assert(low <= high, "bounds are reversed");
    assert(value >= low, "value is below the lower bound");
    assert(value <= high, "value is above the upper bound");
    assert(hash_2([value as Field, salt]) == commitment, "commitment does not match");
}

#[test]
fn inside_bounds() {
    let c = hash_2([42, 7]);
    main(c, 18, 65, 42, 7);
}

#[test(should_fail_with = "value is above")]
fn above_fails() {
    let c = hash_2([70, 7]);
    main(c, 18, 65, 70, 7);
}

#[test(should_fail_with = "commitment does not match")]
fn other_commitment_fails() {
    let c = hash_2([41, 7]);
    main(c, 18, 65, 42, 7);
}
