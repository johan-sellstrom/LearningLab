# Wallet iOS integration notes

This folder contains notes for integrating the Beyond‑EUDI demo features into a fork of the EUDI Reference Wallet for iOS.

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
import IProov

func runIProov(token: String, onResult: @escaping (Bool) -> Void) {
  IProov.launch(streamingURL: URL(string: token)!) { event in
    switch event {
    case .success(_): onResult(true)
    case .failure(_): onResult(false)
    default: break
    }
  }
}
```

- Obtain a claim token from your backend at `POST /iproov/claim`.
- Handle webhook/validate on the server, do not persist images/templates; store only success boolean + audit/reference ID.

## OHTTP client wrapper

Wrap HTTP calls from the wallet to the issuer/verifier using the Cloudflare Privacy Gateway Relay endpoint.

Docs: https://developers.cloudflare.com/privacy-gateway/relay/
