# zkFlash

zkFlash is a zero-knowledge proof testing and verification studio for developers building with Noir. When you build on ZK you need to know whether a proof is valid, how long each step took, which public inputs it used, and why a test failed. zkFlash puts that in one place: it generates real proofs from bundled circuits in your browser, runs valid, invalid and tampered cases against them, and shows expected against actual with a measured time for every stage.

Proof in Motion. Results in View. Building ZK proof testing, verification, and developer tools.

## Read this before anything else

This repository is the working code behind https://zkflash.xyz.

- **What runs today.** The lab, the scenario builder, the monitor and the reports all run in your browser against four circuits compiled in advance. Proofs are real: noir_js solves the witness and Barretenberg generates and verifies an UltraHonk proof in a Web Worker. There are no mock proofs and no stored sample timings.
- **What reads live data.** The block height, gas price and Chainlink ETH/USD on the site are read from Robinhood Chain through a read-only relay in this repository. Token facts appear once a token address is set.
- **The contracts are live on Robinhood Chain with verified source.** The on-chain verifier check works, and the run book reads the contract and sends real transactions from your wallet.
- **What is planned and not built.** Custom circuit upload, a developer SDK and API, hosted test runs, premium reports and $ZKFLASH credits. None of these exist.
- **What nothing here claims.** A verified proof shows only the statement in its circuit, not that the inputs are true or who the prover is. Your address, IP and transaction activity stay visible when you touch a chain. An anchored report shows when a hash was published, not that the report is right. A timing is one measurement on one device, never a benchmark. The bundled circuits have had no outside review, so do not use them to protect value. $ZKFLASH has no promised value.

## Layout

| Path | What it is |
|---|---|
| `circuits/` | The four Noir circuits with their tests, and `build.sh`, which compiles them and generates the Solidity verifier. |
| `contracts/` | Solidity sources (`src/`) and Foundry tests (`test/`), including a real proof fixture. |
| `public/zk/` | Compiled circuits, verification keys and the public setup points. The prover bundle and WASM files here are generated at build time. |
| `scripts/` | The prover bundler, the circuit manifest writer, the proof self-test, `verify-deployment` and the contract artifact builder. |
| `src/app/` | Pages and API routes (Next.js App Router). |
| `src/components/` | Interface components. |
| `src/config/` | `brand.ts` (name, ticker, token address, links) and `contracts.ts` (deployed contract addresses). Every brand value is read from here. |
| `src/lib/zk/` | Circuit definitions, scenarios, the run engine, reports and the prover worker. |
| `src/lib/` | The run book views and practice engine, chain reads, relay rules, rate limits and the logic the tests cover. |

## Run the tests

Node.js 20 or newer.

```
npm install
npm run typecheck
npm test
```

`npm test` includes every bundled scenario with real proofs.

Contracts use [Foundry](https://book.getfoundry.sh/):

```
cd contracts
bash setup.sh
forge test
```

Circuits use `nargo` 1.0.0-beta.22 and `bb` 5.0.0-nightly.20260522. `bash circuits/build.sh --check` reports whether the committed circuits and verifier match a fresh build.

### What was checked for this snapshot

2 November 2026 (UTC), Node.js 25.8.2, forge 1.5.1:

- `npm run typecheck`: exit 0. `npm run lint`: 0 errors.
- `npm test`: 84 pass, 0 fail, 18 of them scenarios with real proofs in Node.
- `forge test`: 45 passed: 34 unit and fuzz tests of `ZkflashRunBook`, 4 invariants, and 7 tests that check a real proof on the generated verifier.
- `nargo test`: 10 passed across the four circuits.
- `npm run build`: 16 routes.
- A browser run on a local chain with id 4663 and injected test wallets: a proof generated in headless Chrome verified locally and through `eth_call`, a flipped byte was rejected by both, a report was anchored, a second wallet attested it, and its proof went through the verifier in a transaction. `verify-deployment` printed MATCH against those local deployments.

Deployed to Robinhood Chain on 2 Nov 2026: `npm run verify-deployment` prints MATCH for every contract and Blockscout shows the source as verified. Not run: anchoring a report or checking a proof through the site on the live contracts (those flows were run on the local chain), real wallet extensions for those writes, and browsers other than Chrome. Not done: any review by an outside party.

## Look at the site

```
npm install
npm run build
npm start
```

Open http://localhost:6050. Everything works with no configuration: proving and local checks need no network beyond this site's own files, and the run book reads the deployed contract. Without `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` the WalletConnect row reads "Not configured on this site yet". To try the lab, open `/lab` and press Generate proof.

## Contracts

| Contract | Address | Explorer |
|---|---|---|
| `ZkflashRunBook` | `0xe89f4d484d494b823b25ca425bcadb34e14da4b8` | [Blockscout](https://robinhoodchain.blockscout.com/address/0xe89f4d484d494b823b25ca425bcadb34e14da4b8?tab=contract) |
| `ZkflashPathCheck` | `0x314204df21ba7c77213d01dc7c6062831d5e3664` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x314204df21ba7c77213d01dc7c6062831d5e3664?tab=contract) |
| `ZkflashSpongeTape` (library of the verifier) | `0x676ac4e2b57df45f2158f706da11f3c2bf52a1e1` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x676ac4e2b57df45f2158f706da11f3c2bf52a1e1?tab=contract) |
| `ZkflashGateChecks` (library of the verifier) | `0x45c3f9b9a14ec800d2b58b6fd766df3f8a437d97` | [Blockscout](https://robinhoodchain.blockscout.com/address/0x45c3f9b9a14ec800d2b58b6fd766df3f8a437d97?tab=contract) |

`ZkflashRunBook` records workspaces with per-workspace roles (lead, runner, reviewer, invite then accept, never zero leads), a circuit registry with versions, report anchors (report hash, outcomes hash, proof hash, case counts) and second-wallet attestations. "Reproduced" must carry the same outcomes hash as the report, which the contract compares. A report moves between anchored, reproduced, disputed and withdrawn. Anyone can run a report's proof through the verifier its circuit names, inside a transaction. It has no owner, no admin, no fee and no upgrade path, takes no ETH and holds no tokens. Results and timings are self-reported: the only thing it checks itself is a proof against the named verifier, and the workspace chooses that verifier.

`ZkflashPathCheck` is generated by `bb` from the `path_member` circuit and links the two libraries. One verification used 2,917,904 gas in a Foundry test.

Deployment gas measured on a local chain with id 4663: `ZkflashSpongeTape` 1,396,146, `ZkflashGateChecks` 1,797,257, `ZkflashPathCheck` 3,923,731, `ZkflashRunBook` 2,808,423. Total 9,925,557.

## Verify a deployment

```
npm run verify-deployment -- --book <address> --book-tx <creation tx> --verifier <address> --verifier-tx <creation tx>
```

The script compares the bytecode on Robinhood Chain with the build in this repository, follows the verifier's library links, checks the verifier's fixed values, and prints MATCH or the first difference. Set `VERIFY_RPC_URL` to use another endpoint.

## Add the network to your wallet

| Field | Value |
|---|---|
| Network | Robinhood Chain |
| Chain ID | 4663 |
| Currency | ETH |
| RPC | https://rpc.mainnet.chain.robinhood.com |
| Explorer | https://robinhoodchain.blockscout.com |

The site offers to add it when you connect.

## Data sources and limits

- **Robinhood Chain RPC** (official endpoint, then public fallbacks): block, gas, the Chainlink ETH/USD feed, token facts and run book state. `/api/chain` caches for a few seconds. The relay at `/api/rpc` serves only the exact read shapes the site issues and never forwards a signed transaction, with a budget per network and a ceiling for the whole site.
- **GeckoTerminal** (network `robinhood`, no key): price and liquidity of the token once it trades.
- **Your browser:** the run log and reports live in local storage and are not sent anywhere. Clearing site data removes them.
- A value that cannot be read shows as "—". Circuit names older than the relay's log window fall back to the name of the matching bundled circuit or a plain label.
- Circuits are limited to the four bundled ones, proving runs on one thread, and the setup points served here cover circuits up to 2^17 gates.

## Token

$ZKFLASH is the community token of zkFlash on Robinhood Chain. Contract address: announced on https://zkflash.xyz at launch. It has no promised value, and every tool here works without it. Hosted test credits, premium reports and API services are planned uses, not built.

## Deploy your own

Import the repository into a Next.js host (preset Next.js, root `./`). The build runs `scripts/build-prover.mjs` first. No variable is required.

| Variable | What it is for | Format |
|---|---|---|
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect row in the wallet dialog | Project id from the WalletConnect dashboard |
| `ROBINHOOD_RPC_URL` | Private RPC for server reads | `https://` URL |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URL` | Private RPC for browser reads | `https://` URL, visible to visitors |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Shared rate limit store across instances | Redis REST URL and token |
| `TRUST_PROXY_HEADERS`, `TRUSTED_PROXY_HOPS`, `CLIENT_IP_HEADER` | Client IP behind your own proxy | `1`, a number, a header name |

Then check `/` answers 200, and `/api/chain` answers JSON.

Contracts: from `contracts/`, use `forge create` in order `ZkflashSpongeTape`, `ZkflashGateChecks`, `ZkflashPathCheck` (pass both with `--libraries`), `ZkflashRunBook`. None takes constructor arguments, and none needs the token. Put the addresses and the run book's block into `src/config/contracts.ts`, then run `npm run verify-deployment`.

## Contributing

Fork the repository, branch from `main`, and run `npm run typecheck`, `npm test` and `npm run build`, and `bash setup.sh && forge test` in `contracts/` before opening a pull request. For a bug, open an issue with the expected and actual behavior and minimal steps. Keep private keys, seed phrases and environment values out of issues.

## Security

Please do not open a public issue for a suspected vulnerability. Use GitHub private vulnerability reporting: open the **Security** tab of this repository and choose **Report a vulnerability**. The contracts, the circuits, the relay and the API routes are in scope; wallets, RPC providers, explorers and launchpads are not. There is no bug bounty.

## Notices and license

This project's original code is released under the [MIT License](LICENSE). Self-hosted fonts: Inter and Geist Mono, under the SIL Open Font License. Wallet logos belong to their projects and are used only to identify the wallet. The public setup points in `public/zk/crs/` come from the Aztec Ignition ceremony. The Solidity verifier is generated by Barretenberg. The zkFlash name, logo and artwork belong to the project and are not licensed for reuse as a brand.
