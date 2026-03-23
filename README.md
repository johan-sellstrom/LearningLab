# Privacy-First ID (Beyond-EUDI Demo)

Monorepo implementing the architecture described in `DEMO.md`:

- issuer/ — OID4VCI issuer (SD-JWT VC + DI/BBS+ modes)
- verifier/ — OID4VP relying party with Digital Credentials API + DPoP/WebAuthn stubs
- demo-conductor/ — local presenter UI that stages the Village speed-build demo
- ohttp/ — Cloudflare Privacy Gateway Worker (relay) template
- bbs-lib/ — BBS+ helper (Node + WASM/Rust via @mattrglobal/bbs-signatures)
- status-list/ — Bitstring Status List generator and sample list
- telemetry/ — DivviUp client stub for aggregate counters
- wallet-ios/ — Notes on integrating iProov & toggles in EUDI iOS wallet
- wallet-android/ — Notes on integrating iProov & toggles in EUDI Android wallet

## Wednesday attendee path

If you are joining the in-person lab, do not start with a local install.

1. Accept the GitHub Classroom invite shared by the instructors.
2. Open your new repo in GitHub Codespaces.
3. Follow [ATTENDEE_QUICKSTART.md](ATTENDEE_QUICKSTART.md).
4. Start Lab 00 from [labs/README-lab-00-start.md](labs/README-lab-00-start.md).

Google Classroom is optional for this repo. GitHub Classroom + Codespaces is the primary student path.

## Other docs

- Detailed lesson guide for students and instructors: [LESSON_RUNBOOK.md](LESSON_RUNBOOK.md)
- Detailed mobile setup and testing guide: [STUDENT_WALLET_RUNBOOK.md](STUDENT_WALLET_RUNBOOK.md)
- Mobile repo layout and fork policy: [WALLET_FORKS.md](WALLET_FORKS.md)

## Public references

- RSAC Conference session catalog: https://path.rsaconference.com/flow/rsac/us26/FullAgenda/page/catalog/session/1755524542872001ceX6
  - Public agenda entry for the conference session tied to this learning-lab work and live demo.
- Beyond Compliance course site: https://beyondcompliance.showntell.dev
  - Public landing page for the lab, framing the repo as a hands-on course for building a privacy-first identity wallet with SD-JWT, BBS+, OHTTP, iProov, and privacy-preserving revocation.
- Beyond Compliance demo site: https://beyondcompliance-demo.showntell.dev
  - Google sign-in entrypoint for the live demo flow, where each attendee gets an isolated session to walk through credential issuance, iProov liveness, and selective disclosure.

## Quickstart

1) Bootstrap prerequisites + install dependencies

- macOS:

```bash
./scripts/bootstrap-mac.sh
```

- Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\bootstrap-windows.ps1
```

Windows troubleshooting
- If `pnpm install` fails with `EPERM`/symlink errors, enable **Developer Mode** (Windows Settings) or run PowerShell as Administrator.

- No local installs (recommended for locked-down laptops): GitHub Codespaces / VS Code Dev Containers
  - This repo includes `.devcontainer/devcontainer.json`.
  - Create a Codespace (or “Reopen in Container”), then run `pnpm dev`.

- Docker (run issuer+verifier in a prebuilt container; wallet lessons are out-of-container):

```bash
docker compose up --build
```

Note: this lab requires **Node.js 20.x** (native deps are published for Node 20).

- If you already have Node.js 20.x installed:

```bash
corepack enable
corepack prepare pnpm@9.7.0 --activate
pnpm env:setup
pnpm install -r --frozen-lockfile
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

## Village demo conductor

For the Village presentation, use the local demo conductor instead of walking attendees through a terminal build.

Recommended local launch:

1. Run `pnpm demo:up`
2. Open `http://localhost:3210`
   - If `GOOGLE_CLIENT_ID` is set, the conductor will show a Google login screen first
3. Keep `http://localhost:3210/presenter-script.html` open if you want the booth run-of-show in a second tab
4. Run the built-in scenario steps:
   - Start issuer
   - Start verifier
   - Issue SD-JWT
   - Complete iProov
   - Issue BBS+
   - Enable relay
   - Revoke credential
   - The iProov step launches the live browser ceremony in the workspace when real credentials are configured; otherwise the BBS+ flow uses the simulated callback path

Containerized launch:

- `pnpm demo:docker`
- or `docker compose up --build demo-conductor`
- plain `docker compose up --build` now defaults to the `demo-conductor` service
- the older standalone `learninglab` container is still available with `docker compose --profile standalone up --build learninglab`
- set `DEMO_CONDUCTOR_REPO_URL` if you want the QR code to point somewhere other than the default repo URL baked into `docker-compose.yml`

Railway deployment:

- the repo includes [railway.toml](railway.toml) for a single-service Railway deploy
- Railway should run the conductor as the public web process while issuer/verifier stay inside the same container as child processes
- the conductor now honors Railway's injected `PORT`
- set `DEMO_CONDUCTOR_BASE_URL` to the public HTTPS origin when you enable Google login on Railway

Fast development mode:

- `pnpm demo:conductor`

The conductor starts and restarts issuer/verifier for you, shows the exact HTTP calls and responses, exposes live issuer/verifier debug state, includes a built-in local relay view for the OHTTP story, and renders a QR code to the GitHub repo for the take-home handoff.

Booth operation notes:

- Use the `Presenter Script` link in the conductor header for a local run-of-show page
- `Reset My Session` or `Shift+R` clears only the signed-in user's artifacts and progress
- Set `IPROOV_API_KEY` and `IPROOV_SECRET` or `IPROOV_MANAGEMENT_KEY` to unlock the real browser ceremony used before BBS+ disclosure verification
- The live iProov web ceremony needs a secure context, so the Railway HTTPS URL is the safest way to run it
- Without real iProov credentials, the conductor falls back to the simulated callback path for the BBS+ disclosure flow
- Set `GOOGLE_CLIENT_ID` to require Google login in the conductor
- Set `DEMO_CONDUCTOR_AUTH_SECRET` to a stable random secret so signed auth cookies survive restarts cleanly
- With Google login enabled, each signed-in user gets isolated conductor state, but issuer/verifier child processes and relay mode are still shared singleton resources on the host

## Wallet forks

The mobile wallet source stays in separate iOS and Android forks beside `LearningLab`. Do not add them as submodules and do not clone them inside this repo.

- Setup helper: `node scripts/setup-wallet-forks.js`
- Student/instructor workflow: [WALLET_FORKS.md](WALLET_FORKS.md)
- Student mobile runbook: [STUDENT_WALLET_RUNBOOK.md](STUDENT_WALLET_RUNBOOK.md)
- Demo-flow guardrail: the browser-based `demo-conductor` path remains the existing demo path and must keep working even while wallet integrations evolve
- iOS native path: use the official iProov iOS SDK on a physical iPhone when real iProov credentials are configured; keep the demo-mode callback fallback for simulator/lab work

## Lab tracks (step-by-step)
- Zero-surprises classroom guide: [LESSON_RUNBOOK.md](LESSON_RUNBOOK.md)
- Lab 00: labs/README-lab-00-start.md
- Lab 01: labs/README-lab-01-issuance.md
- Lab 02: labs/README-lab-02-bbs.md
- Lab 03: labs/README-lab-03-ohttp.md
- Lab 04: labs/README-lab-04-iproov.md
- Lab 05: labs/README-lab-05-revocation.md

## Classroom / autograding (soft gates)

- Recommended progression model:
  - one student repo for the whole course
  - `LAB_ID` selects the active lab in GitHub Actions
  - branch-based lab detection is kept as a local/dev fallback
- Important progression policy:
  - the autograder checks only the currently active `LAB_ID`
  - students do not need to pass Lab 01 before you move them to Lab 02
  - you can move any repo forward at any time by setting `LAB_ID`
- Run a local check (auto-starts services if needed):
  - `pnpm lab:check -- --lab 01`
  - if you already have services on `3001`/`3002`, isolate the run with `ISSUER_BASE_URL=http://127.0.0.1:3101 VERIFIER_BASE_URL=http://127.0.0.1:3102 pnpm lab:check -- --lab 01 --start`
- Run the same command GitHub Actions uses:
  - `pnpm classroom:check`
  - On `main`, this defaults to Lab 05
- Force a specific lab locally:
  - `LAB_ID=03 pnpm classroom:check`
  - or `pnpm classroom:check -- --lab 03`
- Set the active lab on student repos from an instructor machine:
  - `pnpm classroom:set-lab-id --repo owner/student-repo --lab 01`
  - `pnpm classroom:set-lab-id --classroom-csv accepted_assignments.csv --lab 02 --dry-run`
  - `pnpm classroom:set-lab-id --repos-file classroom-repos.txt --lab 02 --dry-run`
- Audit which repos are ready to advance:
  - `pnpm classroom:progress --classroom-csv accepted_assignments.csv`
  - `pnpm classroom:progress --classroom-csv accepted_assignments.csv --only-ready --json`
- Advance every repo currently on a specific lab, regardless of pass/fail:
  - `pnpm classroom:advance --classroom-csv accepted_assignments.csv --from 01`
  - `pnpm classroom:advance --classroom-csv accepted_assignments.csv --from 01 --apply`
- If you want pass-first advancement, opt into it explicitly:
  - `pnpm classroom:advance --classroom-csv accepted_assignments.csv --from 01 --only-ready`
- Use GitHub Classroom + Actions:
  - Workflow: `.github/workflows/classroom.yml`
  - Docs: `COURSE_CLASSROOM.md`
- Scaffold a student template repo:
  - `node scripts/scaffold-classroom-template.js --clean`

### Concrete local loop

1. Prepare the repo: `pnpm env:setup && pnpm install -r --frozen-lockfile`
2. Regenerate the student template when course materials change: `pnpm classroom:template`
3. Run the local autograder exactly like CI: `pnpm classroom:check`
   - On `main`, this validates the final integrated Lab 05 flow
4. Test the GitHub Classroom model explicitly with `LAB_ID=01 pnpm classroom:check` through `LAB_ID=05 pnpm classroom:check`
5. Use branch naming like `lab-01-issuance` only as a local/dev fallback when `LAB_ID` is not set

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

- Configure issuer to use a relay (optional): run `pnpm env:setup` to create `.env` files, then set in `issuer/.env`:

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
