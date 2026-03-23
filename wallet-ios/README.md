# Wallet iOS integration notes

This folder contains notes for integrating the Beyond‑EUDI demo features into a fork of the EUDI Reference Wallet for iOS.

For classroom-facing setup, testing, and troubleshooting instructions, start with [STUDENT_WALLET_RUNBOOK.md](../STUDENT_WALLET_RUNBOOK.md). This file is the engineering note, not the classroom handout.

- EUDI iOS wallet: https://github.com/eu-digital-identity-wallet/eudi-app-ios-wallet-ui
- iProov iOS SDK: https://github.com/iProov/ios

## Features to add

- Feature flags/toggles in Settings for:
  - BBS+ proofs on/off
  - OHTTP client wrapper on/off
  - iProov gating on/off
- iProov integration point (Swift): call `IProov.launch` before signing/presenting.
- Device‑bound key generation (Secure Enclave) is already covered by the EUDI wallet; ensure key is used for VC signatures.

## Minimal iProov call (sketch)

```swift
import iProov

struct IProovClaim: Decodable {
  let session: String
  let token: String
  let streamingURL: String
}

func runIProov(claim: IProovClaim, onResult: @escaping (Bool) -> Void) {
  IProov.launch(streamingURL: URL(string: claim.streamingURL)!, token: claim.token) { event in
    switch event {
    case .success:
      onResult(true)
    case .failure, .canceled, .error:
      onResult(false)
    default:
      break
    }
  }
}
```

- Obtain the native claim from your backend at `GET /iproov/claim`.
- After a successful native SDK run, call `POST /iproov/validate` with the returned `session`.
- The official iProov iOS SDK requires a physical iPhone; keep the web callback fallback for demo/simulator mode.
- The current upstream PoDoFo dependency does not support the generic x86_64 simulator link path; use a concrete arm64 simulator destination on Apple Silicon or a physical device.
- Handle validate/webhook on the server, do not persist images/templates; store only success boolean + audit/reference ID.

## OHTTP client wrapper

Wrap HTTP calls from the wallet to the issuer/verifier using the Cloudflare Privacy Gateway Relay endpoint.

Docs: https://developers.cloudflare.com/privacy-gateway/relay/
