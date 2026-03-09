# Course Outline: Beyond Compliance - Build a Privacy-First Identity Wallet

## How the course works
- Format: 2-hour, hands-on lab. Participants implement features in a reference repo and validate each step with short checks.
- Flow: a short kickoff, then six timeboxed labs. Each lab has a dedicated branch and a step-by-step guide in `labs/README-lab-XX-*.md`.
- Repo model: issuer and verifier services run locally; a mobile wallet (iOS/Android) is patched at specific integration points. A relay and status list service are included.
- Validation: each lab includes pass criteria (expected endpoints, outputs, or behavior). Optional GitHub Classroom + Actions can be used for soft gates.

## Prerequisites (participant setup)
- Node.js 20.x, pnpm, Git
- Xcode (iOS) or Android Studio
- iOS simulator or device (Android optional)
- Cloudflare account (or local worker stub) for OHTTP relay
- iProov sandbox credentials (or mock values for demo)

## Sub lessons (labs) and content

### Lab 00 - Start (Scaffolding + Health Checks) [~10 min]
- Goal: get the scaffold running and confirm all stub endpoints return expected 501s.
- Content:
  - Install dependencies, start issuer/verifier
  - Validate metadata and 501 stubs for offer/token/credential/verify
  - Review annotated code paths to understand the intended flow
- Outcome: local environment is running and ready for implementation

### Lab 01 - SD-JWT Issuance (OIDC4VCI) [~20 min]
- Goal: implement the offer -> token -> credential issuance flow for SD-JWT VCs.
- Content:
  - Build pre-authorized code offers and token exchange with c_nonce
  - Issue SD-JWT VCs with disclosures and ES256 signing
  - Verify SD-JWT on the verifier and expose debug payloads
- Outcome: wallet can obtain and verify SD-JWT credentials

### Lab 02 - BBS+ Selective Disclosure [~25 min]
- Goal: add unlinkable selective disclosure with BBS+ proofs.
- Content:
  - Add a BBS credential configuration
  - Issue DI+BBS credentials and derive selective disclosure proofs
  - Verify proofs and reveal only required claims (e.g., age_over)
- Outcome: verifier accepts unlinkable proofs with minimal disclosure

### Lab 03 - OHTTP Relay [~20 min]
- Goal: route issuer and verifier outbound calls through an OHTTP relay to mask client IPs.
- Content:
  - Deploy or run the relay worker (Cloudflare or local stub)
  - Configure issuer and verifier to use the relay
  - Confirm requests go via the relay
- Outcome: network privacy is enabled for key calls

### Lab 04 - iProov Liveness Gate [~20 min]
- Goal: require liveness verification before issuing or presenting credentials.
- Content:
  - Add claim and webhook endpoints for iProov
  - Gate issuance/presentation on a successful liveness result
  - Add the wallet hook to invoke iProov before signing
- Outcome: credentials are gated by live identity checks

### Lab 05 - Privacy-Preserving Revocation (Bitstring Status List) [~20 min]
- Goal: add revocation checks without tracking holders.
- Content:
  - Generate and serve a bitstring status list
  - Embed credentialStatus in issued credentials
  - Verify status via the list (optionally via OHTTP) and add revoke helper
- Outcome: verifier respects revocation status without direct issuer tracking

## Wrap-up
- Review the privacy and security story: unlinkability, OHTTP, liveness gating, revocation without tracking.
- Provide next steps for integrating wallet UIs and production hardening.
