# MintMe v2 contract verification (#12576)

The existing KB article supplies legacy proxy source for all tokens. Expertize instead runs the gateway's v2 ERC20Token. This change adds a Standard JSON input option to the explorer, preserving the original source paths, dependencies and compiler settings, and supplies the matching verification input and replacement KB content.

## Validation

Run `npm ci --ignore-scripts` and `npm run test:contracts`. These tests isolate RPC and database calls; the v2 scenario uses the actual public Expertize runtime snapshot, not a mock of the compiler result. The pinned Solidity 0.8.28 compiler must reproduce both its complete runtime and the gateway creation-bytecode SHA-256, including metadata. The suite also exercises the route's publication behavior and legacy Solidity 0.4.18 support.

The v2 bundle includes seven files, OpenZeppelin 5.2.0, optimizer disabled (runs 200), EVM paris and the original `contracts/ERC20Token.sol` path. Output selection is the only setting the explorer replaces; it does not alter bytecode or metadata.

## Release order

1. Deploy the explorer change from this issue branch. Panel master corresponds to Redmine version [3.0.0]; the explorer is maintained separately at https://github.com/mintme-com/explorer.
2. Open the verification form and confirm that the compiler list loads and offers 0.8.28. Confirm that `/explorer/contracts/mintme-erc20-v2-0.8.28.json` is accessible.
3. Verify a v2 contract with the exact downloaded JSON, contract name ERC20Token and compiler v0.8.28+commit.7893614a. Standard JSON controls optimizer/EVM settings. Verification publishes the supplied source and ABI; it sends no blockchain transaction. Use an approved test deployment or publish Expertize's original sources as part of the accepted functional test.
4. Check one legacy contract with the legacy source, compiler 0.4.18 and optimization disabled.
5. In the existing panel Knowledge Base admin, find URL `How-to-verify-Smart-Contracts-in-the-MintMe-explorer` and replace its English description with `docs/contract-verification-guide.html`. Preserve the existing title, URL, category and position. Save the previous article content before replacing it. Update translated descriptions to the corrected procedure, or empty stale translated descriptions so the existing English fallback is used until translations are ready.
6. Open the public article and follow its download link and v2 steps. Do not publish the new instructions before the explorer supports them.

No database migration or new panel command is needed. The guide is existing admin-managed content. The HTML is the ready-to-publish description, not a new public article URL.

## Completed local checks

- `npm run test:contracts`: 13 passing tests, including compilation with pinned 0.8.28 and 0.4.18.
- ESLint for the changed server modules and new tests; JavaScript syntax check for the controller; HTML lint for the changed form.
- Chromium on a local HTTP harness using the real form, compiler and Expertize runtime snapshot: successful verification and in-memory publication; malformed JSON shows an error and does not publish; Start Over restores the single-file mode. RPC and MongoDB were isolated.

## Remaining deployment verification

Local tests do not establish that the changed revision is deployed. Record the deployed revision, test address and functional result in Redmine before closing the task. The public production probes performed before implementation returned `valid: false` and did not publish any source.
