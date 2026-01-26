# Beyond‑EUDI: Production‑Grade Demo Architecture

A pragmatic, privacy‑first implementation plan to turn the “beyond‑EUDI” concept into a shippable demo. This document specifies concrete tech choices, code scaffolding, and security notes so you can build end‑to‑end and demo confidently.

---

## Assumptions and scope

- Wallet: EUDI Reference Wallet (iOS and/or Android)
  - iOS: https://github.com/eu-digital-identity-wallet/eudi-app-ios-wallet-ui
  - Android: https://github.com/eu-digital-identity-wallet/eudi-app-android-wallet-ui
- Face biometrics: iProov SDK for enrolment and verification
  - iOS SDK (SPM/CocoaPods): https://github.com/iProov/ios
  - Android SDK: https://docs.iproov.com/android
- Protocols/crypto
  - OID4VCI (issuance): https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html
  - OID4VP (presentation): https://openid.net/specs/openid-4-verifiable-presentation-1_0.html
  - SD‑JWT VC: https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc
  - BBS+ selective disclosure (W3C DI): https://www.w3.org/TR/vc-data-integrity/ and https://github.com/mattrglobal/bbs-signatures
  - OHTTP for network privacy (RFC 9458): https://www.rfc-editor.org/rfc/rfc9458
    - Cloudflare Privacy Gateway (Relay): https://developers.cloudflare.com/privacy-gateway/relay/
    - Fastly OHTTP Relay: https://developer.fastly.com/learning/concepts/oblivious-http/
  - Bitstring Status List (revocation): https://www.w3.org/TR/vc-bitstring-status-list/
  - DPoP (sender‑constrained tokens): https://www.rfc-editor.org/rfc/rfc9449
  - WebAuthn (phishing‑resistant binding): https://www.w3.org/TR/webauthn-3/
  - DAP/DivviUp (privacy‑preserving telemetry): https://divviup.org/

Availability note: the Web Digital Credentials API is evolving; support varies across browsers and may require flags/preview builds. Provide a graceful fallback UI and server flow if unavailable.

---

## 1) Build the complete solution (demo architecture)

### High‑level flow

1. User enrols in the wallet
   - Perform iProov Photo Enrol against a trusted document photo (or authoritative image).
   - Store only iProov’s verification outcome/claim (boolean, audit/reference ID). Do not store face images or templates in your infra.
   - Wallet issues a device‑bound key (Secure Enclave on iOS / StrongBox on Android). Optionally share EAT/RATS evidence with the server to set policy (attested wallet posture).
2. Issuer (OID4VCI) issues two credential variants
   - SD‑JWT VC (mainstream interop)
   - W3C Data Integrity + BBS+ credential for unlinkable selective disclosure
3. Revocation exposed via Bitstring Status List (v1.0)
4. Presentation (OID4VP) via the web using the Digital Credentials API (where supported)
   - Wallet returns a proof to the verifier bound to the origin; use DPoP for sender‑constrained verification
5. Network privacy
   - All issuance/presentation endpoints reachable only via OHTTP (Cloudflare Privacy Gateway Relay or Fastly OHTTP Relay)
6. Telemetry
   - Record only aggregate counters using DAP/DivviUp (no raw per‑user events)

### Monorepo layout

```text
privacy-first-id/
  issuer/                # OID4VCI server (Node/TypeScript)
  verifier/              # OID4VP + Digital Credentials API relying party (Node/TS)
  wallet-ios/            # EUDI iOS app fork + iProov integration
  wallet-android/        # EUDI Android app fork + iProov integration (optional)
  ohttp/                 # Cloudflare Worker or Fastly config for OHTTP relay
  bbs-lib/               # BBS+ helper (Node + WASM/Rust) for demos
  status-list/           # Bitstring Status List publisher (Node)
  telemetry/             # DAP (DivviUp) configs + client
  lab/                   # Learning Lab templates, solutions, slides
```

---

## A. Set up the EUDI Reference Wallet(s)

- iOS: build `eudi-app-ios-wallet-ui` (Swift/SwiftUI) and run on device/simulator.
- Android (optional): build `eudi-app-android-wallet-ui`.
- Keep your fork minimal. Add feature flags (BBS+, OHTTP, iProov) and demo toggles under Settings.

---

## B. Integrate iProov (enrolment + verification)

Why: bind “holder is present & is the right person” without storing biometrics.

1. Create a Service Provider in the iProov console; obtain Service API & Management API credentials and note your `base_url`.
2. Add iProov SDKs
   - iOS via SPM/CocoaPods: https://github.com/iProov/ios
   - Android: https://docs.iproov.com/android
3. Backend endpoints (both issuer and verifier expose)
   - `POST /iproov/claim` → server calls iProov Prepare to mint a stream/claim token
   - Mobile calls the iProov SDK with that token; your server receives the webhook/callback with signals (anti‑spoofing, matching)
4. Enrolment flow
   - Capture/obtain a trusted photo (e.g., from PID or KYC)
   - Use Photo Enrol + Verify to register a template and confirm match
   - Persist only the event receipt/success boolean + timestamp
5. Reuse at presentation
   - Before releasing attributes, call iProov Verify
   - Proceed only on positive Genuine Presence and matching outcome

Swift (wallet) sketch:

```swift
import IProov

func runIProov(token: String, onResult: @escaping (Bool) -> Void) {
  IProov.launch(streamingURL: URL(string: token)!) { event in
    switch event {
    case .success(_):
      onResult(true) // server should double‑check via webhook/validate API
    case .failure(_):
      onResult(false)
    default:
      break
    }
  }
}
```

---

## C. Issuer service (OID4VCI) — Node/TypeScript

- Use an OID4VCI toolkit (e.g., Sphereon/Spruce) or implement minimal endpoints.
- Support two credential formats:
  1. SD‑JWT VC (with selective disclosure)
  2. W3C Data Integrity + BBS+ (unlinkable proofs)

Key endpoints:

```http
POST /.well-known/openid-credential-issuer
POST /credential-offers
POST /token            # OAuth for issuance (DPoP)
POST /credential       # returns SD-JWT VC or DI+BBS+ VC
GET  /statuslist/...   # Bitstring Status List publication
```

Minimal BBS+ helper (Node):

```ts
import { generateKeyPair, sign, createProof } from '@mattrglobal/bbs-signatures'

const { secretKey, publicKey } = await generateKeyPair()
const messages = [/* claims as messages */]
const signature = await sign({ keyPair: { secretKey, publicKey }, messages })

// derive unlinkable proof with selective disclosure
const revealed = [0, 2] // indices to reveal
const proof = await createProof({ signature, publicKey, messages, revealed })
```

Credential status (example inside VC):

```json
{
  "credentialStatus": {
    "id": "https://example.com/statuslist/1.json#12345",
    "type": "BitstringStatusListEntry",
    "statusPurpose": "revocation",
    "statusListIndex": "12345",
    "statusListCredential": "https://example.com/statuslist/1.json"
  }
}
```

---

## D. Verifier app (OID4VP + Digital Credentials API)

- Relying Party (Node/Express) serves a page that calls the Digital Credentials API to request claims (e.g., age‑over, residency).
- Availability varies; feature‑detect at runtime and provide fallback.

Browser snippet (simplified):

```html
<script>
async function requestCredential() {
  const idAPI = navigator?.identity;
  if (idAPI && typeof idAPI.get === 'function') {
    const req = {
      protocol: 'openid4vp',
      request: '<signed OID4VP request JWT>'
    };
    const resp = await idAPI.get(req); // Digital Credentials API
    await fetch('/verify', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(resp)
    });
  } else {
    alert('Digital Credentials API not supported in this browser.');
  }
}
</script>
```

Phishing resistance:

- DPoP on `/verify` (server checks `htu`, `htm`, public‑key thumbprint)
- Optionally require a WebAuthn assertion to the verifier’s origin before accepting the presentation

---

## E. OHTTP network privacy

- Put issuer/verifier APIs behind an OHTTP relay.
  - Cloudflare Privacy Gateway Relay: https://developers.cloudflare.com/privacy-gateway/relay/
  - Fastly OHTTP Relay: https://developer.fastly.com/learning/concepts/oblivious-http/
- Publish your OHTTP configuration and fetch it in the wallet and verifier to route encrypted requests: client → relay → gateway → origin.

Why: the origin cannot link requests to a client/IP — crucial to avoid correlation at issuance and status checks (standards‑based; RFC 9458).

---

## F. Revocation without tracking

- Use a Bitstring Status List served via CDN and fetched via OHTTP to avoid “revocation ping = tracking beacon.”
- Consider short‑lived credentials + refresh hints (VC Refresh 2021) to reduce status checks.

---

## G. Privacy‑preserving telemetry (optional but valuable)

- Deploy DivviUp (ISRG) leader/helper or use hosted endpoints where available: https://divviup.org/
- Wallet/verifier submit encrypted, batched counters only (e.g., “presentations_succeeded”, “iproov_retry_count”). No raw events.

---

## H. Security and compliance guardrails

- Enforce pairwise/ephemeral identifiers for any OIDC flows (PPID/sector identifier).
- Store only: credential metadata, status‑list bit index, iProov signals result (boolean + audit/reference ID). Never store images/templates.
- Provide ISO/IEC 27560/Kantara machine‑readable consent receipts when attributes are shared.
- Bind presentations to origin: DPoP + (optional) WebAuthn ceremony at the verifier origin.

---

## Appendix: Environment configuration (example)

```env
# issuer/
ISSUER_SIGNING_KEY=...
STATUS_LIST_URL=https://example.com/statuslist/1.json
USE_OHTTP=true
IPROOV_BASE_URL=https://eu.rp.iproov.me
IPROOV_API_KEY=...

# verifier/
USE_OHTTP=true
DPoP_REQUIRED=true
WEBAUTHN_RP_ID=verifier.example.com
```
