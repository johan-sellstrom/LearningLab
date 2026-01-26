# Learning Lab: Beyond Compliance — Build a Privacy‑First Identity Wallet (2 hours)

Hands‑on lab where participants fork a reference repo, implement issuance (SD‑JWT VC), add unlinkable selective disclosure (BBS+), route flows via OHTTP, gate presentations with iProov liveness, and verify revocation using Bitstring Status List — with phishing‑resistant bindings.

---

## Prerequisites

- Node.js 20+
- Git
- Xcode (for iOS) or Android Studio (for Android)
- iOS simulator or device; Android device/emulator optional
- Cloudflare account (free) or Fastly trial (for OHTTP relay)
- iProov sandbox credentials

Reference repositories and docs:

- EUDI Reference Wallet
  - iOS: https://github.com/eu-digital-identity-wallet/eudi-app-ios-wallet-ui
  - Android: https://github.com/eu-digital-identity-wallet/eudi-app-android-wallet-ui
- iProov SDK
  - iOS: https://github.com/iProov/ios
  - Android: https://docs.iproov.com/android
- OHTTP
  - Cloudflare Privacy Gateway Relay: https://developers.cloudflare.com/privacy-gateway/relay/
  - Fastly OHTTP Relay: https://developer.fastly.com/learning/concepts/oblivious-http/
- DivviUp (DAP): https://divviup.org/

---

## What you provide (repo structure)

- **Read this first (annotated code paths)**
  - `issuer/src/index.ts`: Inline comments explain each OIDC4VCI step (offer → token with c_nonce → credential issuance), DPoP checks, status list, and demo helpers.
  - `verifier/src/index.ts`: Notes on Digital Credentials API + OpenID4VP flow, nonce/presentation_submission checks, SD-JWT and BBS+ verification.
  - `bbs-lib/src/index.ts`: Tiny wrapper around BBS+ with comments on signing, deriving, and verifying proofs.

- A GitHub repo with branches:
  - `lab-00-start`, `lab-01-issuance`, `lab-02-bbs`, `lab-03-ohttp`, `lab-04-iproov`, `lab-05-revocation`
  - Matching `solutions/` mirrors per lab
- Starter directories:
  - `issuer/`: minimal OID4VCI (Express) with SD‑JWT VC and BBS+ modes
  - `verifier/`: Express + EJS page with Digital Credentials API button, DPoP middleware, WebAuthn bootstrap
- `ohttp/`: Cloudflare Worker script + `wrangler.toml` example
- `status-list/`: script to mint and flip bits in a status list
- `telemetry/`: DivviUp client stub for aggregate counters only
- `wallet-ios/`: Swift patches for iProov integration point, BBS+ toggle, OHTTP client wrapper

Step-by-step build guides (so participants can code without guessing):
- Lab 00: `labs/README-lab-00-start.md`
- Lab 01: `labs/README-lab-01-issuance.md`
- Lab 02: `labs/README-lab-02-bbs.md`
- Lab 03: `labs/README-lab-03-ohttp.md`
- Lab 04: `labs/README-lab-04-iproov.md`
- Lab 05: `labs/README-lab-05-revocation.md`

---

## Agenda (120 minutes)

- 0–10 min — Kickoff & Threat Model
  - What we’re defending: correlation, phishing, revocation beacons, telemetry leaks
- 10–30 min — Exercise 1: Issue an SD‑JWT VC (OID4VCI)
- 30–55 min — Exercise 2: Add BBS+ unlinkable selective disclosure
- 55–75 min — Exercise 3: Turn on OHTTP for issuance and status
- 75–95 min — Exercise 4: Gate presentations with iProov liveness
- 95–115 min — Exercise 5: Privacy‑preserving revocation (Bitstring Status List)
- 115–120 min — Wrap‑up & Checklist

Note: The Web Digital Credentials API is evolving; some browsers may require flags or preview versions. Provide a fallback message.

---

## Exercise 1 (10–30 min): Issue an SD‑JWT VC (OID4VCI)

- Goal: Wallet requests and stores an SD‑JWT VC from your issuer
- Steps
  - Checkout `lab-01-issuance`
  - Run issuer: `pnpm i && pnpm dev`
  - In the wallet, scan credential offer QR → receive SD‑JWT VC
- Pass criteria: Verifier endpoint `/debug/credential` shows valid signature and expected claims
- References: SD‑JWT VC and OID4VCI specs

---

## Exercise 2 (30–55 min): Add BBS+ unlinkable selective disclosure

- Goal: Derive a proof revealing only `age_over = 18`
- Steps
  - Checkout `lab-02-bbs`
  - Implement `POST /credential?fmt=bbs` (use `@mattrglobal/bbs-signatures`)
  - In the wallet, “Present with BBS+” → send derived proof
- Pass criteria: `/verify` logs “unlinkable proof ok; only claim X revealed.”
- References: W3C Data Integrity + BBS+

---

## Exercise 3 (55–75 min): Turn on OHTTP for issuance and status

- Goal: Requests traverse a relay so servers can’t link to clients
- Steps
  - Checkout `lab-03-ohttp`
  - Deploy Cloudflare Privacy Gateway Worker (copy/paste template). Set `OHTTP_RELAY` env and origin key config
  - Flip `USE_OHTTP=true` in issuer/verifier environment
- Pass criteria: Server access logs show relay IPs only; direct IPs masked
- References: RFC 9458

---

## Exercise 4 (75–95 min): Gate presentations with iProov liveness

- Goal: Require successful iProov Verify before releasing attributes
- Steps
  - Checkout `lab-04-iproov`
  - Configure backend `/iproov/claim` + webhook (see README)
  - Add Swift call to `IProov.launch` before the wallet signs/presents
- Pass criteria: Presentation blocked until webhook indicates `signals.matching.passed = true`

Swift snippet:

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

---

## Exercise 5 (95–115 min): Privacy‑preserving revocation (Bitstring Status List)

- Goal: Verifier checks status without tracking the holder
- Steps
  - Checkout `lab-05-revocation`
  - Issuer publishes `/statuslist/1.json` (e.g., 200k bits). Wallet includes `credentialStatus`
  - Verifier fetches list via OHTTP and evaluates bit index
- Pass criteria: Toggling a bit flips verification outcome; no direct calls to issuer (all via relay)

---

## Wrap‑up (115–120 min): Checklist and next steps

- Attestation/EAT hooks
- DPoP/WebAuthn binding to verifier origin
- DAP/DivviUp telemetry (optional follow‑up) — keep only aggregate counters

---

## Facilitator notes

- Keep iProov credentials in a server‑side `.env` only; never in the app
- If time runs short, mark DivviUp as read‑only demo but leave code in repo
- Always demo via OHTTP to make the “no IP” story visceral (logs show relay)

---

## Demo script (stage run‑through)

1. Enroll with iProov: live face check succeeds → wallet “unlocks” issuance
2. Issue SD‑JWT VC and BBS+ VC side‑by‑side
3. Present via browser (Digital Credentials API)
   - First with SD‑JWT (verifier sees claim values)
   - Then with BBS+ (verifier sees only `over18 = true`; unlinkable between sessions)
4. Pull the plug: flip a revocation bit → verifier rejects next presentation (all over OHTTP)

---

## Risk and compliance callouts (include in README)

- No biometrics at rest: store only iProov signals/result references; no images/templates
- Pairwise IDs for any OIDC touches; prefer ephemeral subject identifiers where practical
- Consent receipts for every attribute release (ISO/IEC 27560 JSON)
- Origin binding: DPoP + optional WebAuthn ceremony to the verifier origin

---

## What participants will have at the end

A working EUDI wallet fork with iProov gating, BBS+ proofs, OHTTP‑protected flows, Bitstring Status List revocation, and a web verifier using the Digital Credentials API with phishing‑resistant bindings — plus lab materials ready to run at RSAC.
