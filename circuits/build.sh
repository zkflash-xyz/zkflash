#!/usr/bin/env bash
# Rebuilds every bundled circuit, the Solidity verifier of path_member and the browser artifacts.
# Needs nargo 1.0.0-beta.22 and bb 5.0.0-nightly.20260522 (the versions bb.js and noir_js in package.json match).
#   ~/.nargo/bin/nargo, ~/.bb/bb (or on PATH)
# With --check it only reports whether the committed files match a fresh build.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
NARGO="$(command -v nargo || echo ~/.nargo/bin/nargo)"
BB="$(command -v bb || echo ~/.bb/bb)"
"$NARGO" --version | head -1
"$BB" --version
CHECK="${1:-}"
for c in hash_opening range_gate path_member tally_floor; do
  cd "$ROOT/$c"
  "$NARGO" test
  "$NARGO" compile
  "$BB" write_vk -b "target/$c.json" -o target -t evm
  if [ "$CHECK" = "--check" ]; then
    node -e 'const a=require(process.argv[1]),b=require(process.argv[2]);if(a.bytecode!==b.bytecode)process.exit(1)' "$PWD/target/$c.json" "$ROOT/../public/zk/$c.json" && echo "$c artifact matches"
  else
    # Ship only what provers need; debug symbols and the file map carry local paths.
    node -e 'const j=require(process.argv[1]);require("fs").writeFileSync(process.argv[2],JSON.stringify({noir_version:j.noir_version,hash:j.hash,abi:j.abi,bytecode:j.bytecode}))' "$PWD/target/$c.json" "$ROOT/../public/zk/$c.json"
    cp target/vk "$ROOT/../public/zk/$c.vk"
  fi
done
cd "$ROOT/path_member"
"$BB" write_solidity_verifier -k target/vk -o target/generated-verifier.sol -t evm
# bb names every verifier the same; give this project's contracts their own names.
sed -E -f ../verifier-names.sed target/generated-verifier.sol > target/ZkflashPathCheck.sol
if grep -nE '[[:<:]](Honk|ZKTranscript|Relations|FrLib|IVerifier|Errors)[A-Za-z]*[[:>:]]' target/ZkflashPathCheck.sol | grep -v 'Zkflash' | head -3 | grep -q .; then
  echo "verifier still carries generic names; extend circuits/verifier-names.sed" >&2
  exit 1
fi
if [ "$CHECK" = "--check" ]; then
  cmp target/ZkflashPathCheck.sol ../../contracts/src/ZkflashPathCheck.sol && echo "verifier matches"
else
  cp target/ZkflashPathCheck.sol ../../contracts/src/ZkflashPathCheck.sol
  echo "verifier and artifacts updated"
fi
