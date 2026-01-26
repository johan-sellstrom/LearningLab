# Privacy-First ID (Beyond-EUDI Demo)

Monorepo implementing the architecture described in `DEMO.md`:

- issuer/ — OID4VCI issuer (SD-JWT VC + DI/BBS+ modes)
- verifier/ — OID4VP relying party with Digital Credentials API + DPoP/WebAuthn stubs
- ohttp/ — Cloudflare Privacy Gateway Worker (relay) template
- bbs-lib/ — BBS+ helper (Node + WASM/Rust via @mattrglobal/bbs-signatures)
- status-list/ — Bitstring Status List generator and sample list
- telemetry/ — DivviUp client stub for aggregate counters
- wallet-ios/ — Notes on integrating iProov & toggles in EUDI iOS wallet

## Quickstart

1) Install dependencies (requires pnpm):

```bash
pnpm -v   # ensure pnpm installed
pnpm install -r
```

2) Run services in parallel:

```bash
pnpm dev
```

- Issuer: http://localhost:3001
- Verifier: http://localhost:3002
- JWKS: http://localhost:3001/.well-known/jwks.json
- BBS public key: http://localhost:3001/.well-known/bbs-public-key

3) Generate a status list (optional):

```bash
pnpm --filter status-list run generate
```

See `DEMO.md` for architecture and `LEARNING_LAB.md` for the 2-hour lab.

## Lab tracks (step-by-step)
- Lab 00: labs/README-lab-00-start.md
- Lab 01: labs/README-lab-01-issuance.md
- Lab 02: labs/README-lab-02-bbs.md
- Lab 03: labs/README-lab-03-ohttp.md
- Lab 04: labs/README-lab-04-iproov.md
- Lab 05: labs/README-lab-05-revocation.md

## Classroom / autograding (soft gates)

- Run a local check (auto-starts services if needed):
  - `pnpm lab:check -- --lab 01`
- Use GitHub Classroom + Actions:
  - Workflow: `.github/workflows/classroom.yml`
  - Docs: `COURSE_CLASSROOM.md`
- Scaffold a student template repo:
  - `node scripts/scaffold-classroom-template.js --clean`

## Demo flows (terminal)

- OIDC4VCI (SD-JWT VC)
  1. Offer (pre-authorized code): `curl -s -X POST http://localhost:3001/credential-offers -H 'content-type: application/json' -d '{"credentials":["AgeCredential"]}' | jq`
  2. Token (c_nonce returned): `curl -s -X POST http://localhost:3001/token -H 'content-type: application/json' -d '{"grant_type":"urn:ietf:params:oauth:grant-type:pre-authorized_code","pre-authorized_code":"<code_from_offer>"}' | jq`
  3. Credential: `curl -s -X POST http://localhost:3001/credential -H "authorization: Bearer <access_token>" -H 'content-type: application/json' -d '{"format":"vc+sd-jwt","claims":{"age_over":21,"residency":"SE"}}' | jq`
     - With DPoP on, include a valid `DPoP:` header and `proof.jwt` binding the `c_nonce` to the holder key (see `issuer/example.env`).
  4. Verify SD-JWT: `curl -s -X POST http://localhost:3002/verify -H 'content-type: application/json' -d '{"format":"vc+sd-jwt","credential":"<sd_jwt~disclosures from issuer>"}' | jq`
- OIDC4VCI (DI+BBS+)
  1. Offer/token as above but use `"credentials":["AgeCredentialBBS"]`
  2. Credential: `curl -s -X POST http://localhost:3001/credential -H "authorization: Bearer <access_token>" -H 'content-type: application/json' -d '{"format":"di-bbs","claims":{"age_over":25,"residency":"SE"}}' | jq`
  3. Derive proof (demo helper): `curl -s -X POST http://localhost:3001/bbs/proof -H 'content-type: application/json' -d '{"signature":"<signature>","messages":[<messages array>],"reveal":[1],"nonce":"bbs-demo-nonce"}' | jq`
  4. Verify proof: `curl -s -X POST http://localhost:3002/verify -H 'content-type: application/json' -d '{"format":"di-bbs","proof":{"proof":"<proof>","revealedMessages":["age_over:25"],"nonce":"bbs-demo-nonce"},"credentialStatus":{"statusListIndex":"<from issuer>","statusListCredential":"http://localhost:3001/statuslist/1.json"}}' | jq`
- OIDC4VP (Digital Credentials API): `curl -s http://localhost:3002/vp/request | jq` to get a request + nonce, then POST the wallet response to `/verify` (or use the browser button on `/`).
- Revoke (requires `ADMIN_TOKEN` in `issuer/.env`): `curl -X POST http://localhost:3001/revoke/<credentialId> -H 'x-admin-token: <ADMIN_TOKEN>'` then re-run `/verify` to see the revoked status bit applied.
- Debug: `curl -s http://localhost:3001/debug/issued | jq` and `curl -s http://localhost:3002/debug/credential | jq`

## OHTTP Relay (Cloudflare Privacy Gateway)

- This repo includes an `ohttp/` Cloudflare Worker stub. For production, use Cloudflare Privacy Gateway (preferred). Docs:
  - https://developers.cloudflare.com/privacy-gateway/relay/
- Local dev for the stub:

```bash
pnpm -F ohttp dev
# opens http://localhost:8787 (returns 501 with docs link)
```

- Configure issuer to use a relay (optional): copy `issuer/example.env` to `issuer/.env` and set:

```
USE_OHTTP=false
OHTTP_RELAY_URL=https://<your-cloudflare-relay-domain>.workers.dev
```

## Telemetry (aggregate counters only)

- The `telemetry/` package counts only aggregates (no per-user events).
- The verifier exposes `GET /debug/telemetry` to inspect counters during dev.

Example quick check while verifier is running:

```bash
curl -s -X POST http://localhost:3002/verify -H 'content-type: application/json' -d '{"demo":true}'
curl -s http://localhost:3002/debug/telemetry | jq
```

## Status List generation & serving

- Generate the initial list (default 8192 bits), output at `status-list/data/1.json`:

```bash
pnpm --filter status-list run generate
```

- Issuer serves lists from `/statuslist/:id.json`, e.g.:

```bash
curl http://localhost:3001/statuslist/1.json | jq
```
