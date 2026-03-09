# Outline

Session Description
Delivery Format: Learning Lab
Session Code: LAB1-XXX (TBD)
Scheduled Date: TBD
Scheduled Time: 120 minutes
Session Title: Beyond Compliance - Build a Privacy-First Identity Wallet

Session Abstract:
This learning lab is a hands-on build of a privacy-first identity wallet and its supporting issuer and verifier services. Participants implement SD-JWT VC issuance, add BBS+ selective disclosure for unlinkable presentations, route traffic through OHTTP for network privacy, gate flows with iProov liveness, and verify revocation using a Bitstring Status List. The session emphasizes privacy by design, minimal disclosure, and phishing-resistant bindings, while keeping the implementation practical and runnable on attendee laptops.

Facilitator(s):
- Johan Sellström


Technical Requirements:
- Attendees bring their own laptops
- Node.js 20.x and pnpm installed
- Git installed
- Xcode (iOS) or Android Studio (optional for mobile wallet patch)
- iOS simulator or device (Android optional)
- Cloudflare account or local worker stub for OHTTP relay
- iProov sandbox credentials (or mock values for demo)

Outline:
- 0-10 minutes - Kickoff, goals, and privacy threat model (correlation, phishing, revocation beacons)
- 10-30 minutes - Lab 01: SD-JWT issuance (OIDC4VCI offer -> token -> credential)
- 30-55 minutes - Lab 02: BBS+ selective disclosure (unlinkable proofs, reveal only age_over)
- 55-75 minutes - Lab 03: OHTTP relay (route issuer/verifier calls through relay)
- 75-95 minutes - Lab 04: iProov liveness gate (block issuance/presentation until pass)
- 95-115 minutes - Lab 05: Bitstring Status List revocation (status list check via relay)
- 115-120 minutes - Wrap-up, checklist, and next steps

Notes for Organizer:
- Each lab has a step-by-step guide in `labs/README-lab-XX-*.md` and a dedicated branch.
- Pass criteria are included per lab so attendees can self-verify progress.
- Optional: GitHub Classroom + Actions can provide soft gates and automated checks.
