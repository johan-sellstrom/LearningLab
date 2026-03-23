# Wallet Fork Workflow

The mobile wallet work lives in separate git repositories. Do not add the wallets to `LearningLab` as submodules and do not clone them inside this repo.

Detailed student-facing setup and troubleshooting lives in [STUDENT_WALLET_RUNBOOK.md](STUDENT_WALLET_RUNBOOK.md). Use that file during class. This file explains the repo policy and the integration boundary.

Why:

- students should clone only the platform they need
- mobile build tooling should stay isolated from the Node lab repo
- the existing demo-conductor flow must remain untouched

## What stays unchanged

The browser-based demo path in `demo-conductor/` is still the supported booth/demo flow. Wallet work is additive. If a wallet integration fails, the demo-conductor flow must still work exactly as it does today.

## Repo layout

Recommended workspace layout:

```text
RSA/
  LearningLab/
  eudi-app-ios-wallet-ui/
  eudi-app-android-wallet-ui/
```

## Clone the wallet forks

From `LearningLab/`:

```bash
node scripts/setup-wallet-forks.js
```

Platform-specific clone:

```bash
node scripts/setup-wallet-forks.js --platform ios
node scripts/setup-wallet-forks.js --platform android
```

Preview only:

```bash
node scripts/setup-wallet-forks.js --dry-run
```

SSH clone:

```bash
node scripts/setup-wallet-forks.js --protocol ssh
```

## Student workflow

Students should:

1. Clone `LearningLab` and run the normal Node setup.
2. Clone only one wallet fork beside `LearningLab`.
3. Open the wallet repo in Xcode or Android Studio.
4. Point the wallet at the local `issuer` and `verifier` services.
5. Treat wallet iProov support as an advanced/mobile track. The web demo path is separate and must not be used as the mobile integration point.

## Student baseline

Students should receive a wallet fork where the iProov plumbing already exists.

The classroom expectation is not "students build iProov from scratch". The classroom expectation is "students can run the wallet, point it at the local issuer, and understand where the gate sits in the presentation flow."

- iOS:
  - real iProov credentials + physical iPhone: use the official native iProov iOS SDK
  - demo mode: use the wallet-launched web fallback from `POST /iproov/mobile/claim`
  - simulator support: use a concrete arm64 simulator destination, not `Any iOS Simulator Device`
- Android:
  - keep the current wallet gate additive and separate from the browser demo flow

Students should only need to:

1. run `issuer` and `verifier`
2. set the wallet issuer URL
3. understand where the iProov gate sits in the presentation flow
4. test the flow on a simulator in demo mode or on a real device for native iProov

## iProov integration points

Use these hook points so iProov runs immediately before a presentation leaves the wallet:

- iOS: `Modules/feature-presentation/Sources/UI/Presentation/Loading/PresentationLoadingViewModel.swift`
  - gate `interactor.onSendResponse()`
- Android: `presentation-feature/src/main/java/eu/europa/ec/presentationfeature/ui/loading/PresentationLoadingViewModel.kt`
  - gate `sendRequestedDocuments()`

Expected iOS sequence:

1. Wallet calls `GET /iproov/config`.
2. If `realCeremonyEnabled=true`, the wallet calls `GET /iproov/claim`.
3. Wallet launches the official iProov iOS SDK with the returned `token` and `streamingURL`.
4. On native success, the wallet calls `POST /iproov/validate` with the `session`.
5. Only then does the wallet continue with the normal presentation flow.

Expected iOS demo fallback:

1. Wallet calls `POST /iproov/mobile/claim` with callback URL `eudi-wallet://iproov`.
2. Wallet opens the returned `launchUrl`.
3. The issuer-hosted page completes the demo ceremony and redirects back into the wallet.
4. Wallet confirms the returned `session` through `GET /iproov/session/:session`.
5. Only then does the wallet continue with the normal presentation flow.

Important:

- the official iProov iOS SDK does not run in the simulator; use a physical iPhone for the native path
- the current upstream PoDoFo dependency fails the generic x86_64 simulator link step with `_OBJC_CLASS_$_PodofoWrapper`; use an arm64 simulator on Apple Silicon or a physical device
- the browser-based `demo-conductor` path remains the booth/demo flow and must continue to work unchanged

## Student deliverable boundary

The repo should give students a working wallet fork baseline. Students can still inspect and understand the iProov integration, but they should not need to build that plumbing from scratch just to complete the lab.
