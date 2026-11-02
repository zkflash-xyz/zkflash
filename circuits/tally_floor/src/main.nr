// zkFlash bundled circuit: tally floor.
// Statement: eight private counts, folded into the public commitment, add up to at least the public
// floor. The individual counts and the exact total stay in the witness.
use poseidon::poseidon::bn254::hash_2;

pub global COUNTS: u32 = 8;

fn fold(counts: [u32; COUNTS], salt: Field) -> Field {
    let mut acc = salt;
    for i in 0..COUNTS {
        acc = hash_2([acc, counts[i] as Field]);
    }
    acc
}

fn main(commitment: pub Field, floor: pub u64, counts: [u32; COUNTS], salt: Field) {
    let mut total: u64 = 0;
    for i in 0..COUNTS {
        total += counts[i] as u64;
    }
    assert(total >= floor, "total is under the floor");
    assert(fold(counts, salt) == commitment, "commitment does not match");
}

#[test]
fn over_floor() {
    let counts = [1, 2, 3, 4, 5, 6, 7, 8];
    main(fold(counts, 9), 36, counts, 9);
}

#[test(should_fail_with = "total is under")]
fn under_floor_fails() {
    let counts = [1, 2, 3, 4, 5, 6, 7, 8];
    main(fold(counts, 9), 37, counts, 9);
}
