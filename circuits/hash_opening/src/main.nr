// zkFlash bundled circuit: hash opening.
// Statement: the prover knows two field elements whose Poseidon hash equals the public digest.
// It says nothing about who the prover is, and nothing about where the digest came from.
use poseidon::poseidon::bn254::hash_2;

fn main(digest: pub Field, left: Field, right: Field) {
    assert(hash_2([left, right]) == digest, "digest does not open to these values");
}

#[test]
fn opens() {
    main(0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a, 1, 2);
}

#[test(should_fail_with = "digest does not open")]
fn wrong_value_fails() {
    main(0x115cc0f5e7d690413df64c6b9662e9cf2a3617f2743245519e19607a4417189a, 1, 3);
}
