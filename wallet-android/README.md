# Wallet Android integration notes

This folder contains notes for integrating the Beyond‑EUDI demo features into a fork of the EUDI Reference Wallet for Android.

For classroom-facing setup, testing, and troubleshooting instructions, start with [STUDENT_WALLET_RUNBOOK.md](../STUDENT_WALLET_RUNBOOK.md). This file is the engineering note, not the classroom handout.

- EUDI Android wallet: https://github.com/eu-digital-identity-wallet/eudi-app-android-wallet-ui
- iProov Android SDK (docs + samples): https://github.com/iProov/android

## Features to add

- Feature flags/toggles in Settings for:
  - BBS+ proofs on/off
  - OHTTP client wrapper on/off
  - iProov gating on/off
- iProov integration point (Android): run an iProov Verify scan before signing/presenting.
- Device‑bound key generation (Android Keystore / StrongBox) is already covered by the EUDI wallet; ensure the holder key is used for VC signatures.

## iProov integration sketch (high level)

1) Obtain a single-use claim token from your backend at `POST /iproov/claim`.
2) Start an iProov session in the app using the iProov Android SDK.
3) Block “Present / Share attributes” until the backend has received a webhook (or validated the token) indicating the session passed.

Notes:
- Do not store face images/templates in your infrastructure. Persist only the outcome (boolean) and an audit/reference ID.
- For concrete SDK usage and sample code, follow the upstream iProov Android SDK README: https://github.com/iProov/android

## OHTTP client wrapper

Wrap HTTP calls from the wallet to the issuer/verifier using the Cloudflare Privacy Gateway Relay endpoint.

Docs: https://developers.cloudflare.com/privacy-gateway/relay/
