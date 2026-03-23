# Lesson Runbook

This is the classroom-facing guide for the current `LearningLab` repo. Use this file if you want one place that answers the questions students and TAs will otherwise keep asking.

The per-lab branch handouts in [classroom-template/labs](classroom-template/labs) are still useful, but they describe the original branch-by-branch teaching model. This runbook explains how the current integrated `main` branch behaves, how `LAB_ID` changes that behavior for grading, and what a student is expected to do in each lesson.

## Non-Negotiable Rules

- Do not use `demo-conductor/` as the student lab path. It is the booth/demo path.
- Do not put the wallet repos inside `LearningLab` and do not add them as submodules.
- On `main`, the repo is already the final integrated system. It is not a blank Lab 00 scaffold.
- `LAB_ID` is the mechanism that makes the integrated repo behave like an earlier lesson during checks.
- The wallet track is additive. Core issuer/verifier lessons must still make sense without mobile work.

## Read This First

There are four different ways this repo can be used:

1. Classroom lesson mode
   - Use `pnpm lab:check -- --lab 01 --start --verbose` or `LAB_ID=01 pnpm classroom:check`.
   - This is the mode to use while teaching Labs 00 through 05.
   - `scripts/lab-check.js` starts issuer and verifier with `LAB_ID` set and applies any lesson-specific compatibility shims.

2. Final integrated mode on `main`
   - Use `pnpm dev` with no `LAB_ID`.
   - This is the real combined runtime for the repo as it exists today.
   - Some behaviors differ from the original lesson branches because the repo has moved on to the final integrated state.

3. Demo-conductor mode
   - Use `pnpm demo:up` or `pnpm demo:conductor`.
   - This is the public demo / booth flow.
   - It must remain working even if student lab or wallet work changes.

4. Wallet mode
   - Use the external iOS or Android fork beside `LearningLab`.
   - This is an advanced/mobile track.
   - Students should not need to build the iProov plumbing from scratch to complete the core lessons.

## One-Time Setup

Before class, make sure every student can complete these steps:

1. Install Node.js 20.x and pnpm.
2. Clone the repo.
3. Run:

```bash
pnpm env:setup
pnpm install -r --frozen-lockfile
```

4. Start the services:

```bash
pnpm dev
```

5. Confirm the expected local URLs:
   - Issuer: `http://localhost:3001`
   - Verifier: `http://localhost:3002`
   - Issuer metadata: `http://localhost:3001/.well-known/openid-credential-issuer`
   - JWKS: `http://localhost:3001/.well-known/jwks.json`
   - BBS public key: `http://localhost:3001/.well-known/bbs-public-key`

## The Exact Teaching Loop

For each lesson:

1. Keep one terminal on `pnpm dev`, unless you are letting the checker start services for the student.
2. Keep a second terminal for the lab check:

```bash
pnpm lab:check -- --lab 00 --start --verbose
pnpm lab:check -- --lab 01 --start --verbose
pnpm lab:check -- --lab 02 --start --verbose
pnpm lab:check -- --lab 03 --start --verbose
pnpm lab:check -- --lab 04 --start --verbose
pnpm lab:check -- --lab 05 --start --verbose
```

3. If the services are already running and you do not want the checker to start them, use `--no-start`.
4. In GitHub Classroom, the equivalent command is:

```bash
LAB_ID=03 pnpm classroom:check
```

## How `LAB_ID` Changes Behavior

This matters because the integrated `main` branch is not identical to the original lesson branches.

- `LAB_ID=00` and `LAB_ID=01`
  - behave like the early SD-JWT lessons
  - no special compatibility needed

- `LAB_ID=02`
  - the verifier temporarily does not require an `iproov_session` for BBS proof verification
  - reason: Lab 02 is supposed to teach BBS+ proof derivation, not liveness

- `LAB_ID=03`
  - the checker starts a local relay stub and turns on `USE_OHTTP=true`
  - reason: the student should prove relay routing without needing a real deployed relay

- `LAB_ID=04`
  - the issuer temporarily restores issuance-time iProov gating on `/credential`
  - reason: Lab 04 is supposed to teach the liveness gate in isolation

- `LAB_ID=05`
  - behaves like the final integrated revocation lesson
  - no extra compatibility is applied beyond normal integrated behavior

With no `LAB_ID`, the repo uses its final integrated policy:

- SD-JWT issuance and verification are the normal path.
- BBS verification can require an iProov session in the final flow.
- The browser demo path stays separate in `demo-conductor/`.
- Wallet integration stays additive and external.

## Lesson 00

Goal:
- make sure the scaffold boots
- make sure the student understands where the issuer and verifier live
- confirm stubs or basic endpoints behave as expected

Student focus:
- read [issuer/src/index.ts](issuer/src/index.ts)
- read [verifier/src/index.ts](verifier/src/index.ts)
- read [bbs-lib/src/index.ts](bbs-lib/src/index.ts)

Commands:

```bash
pnpm env:setup
pnpm install -r
pnpm dev
pnpm lab:check -- --lab 00 --start --verbose
```

What the student should see:
- the issuer metadata endpoint responds
- the basic issuer and verifier routes are reachable
- no 5xx server crash

Questions already answered:
- "Do I build anything in Lab 00?" No. Lab 00 is setup and orientation.
- "Should I touch the wallet in Lab 00?" No.

## Lesson 01

Goal:
- implement SD-JWT issuance over the simple OIDC4VCI pre-authorized-code flow
- verify the resulting SD-JWT on the verifier

Student edits:
- [issuer/src/index.ts](issuer/src/index.ts)
- [verifier/src/index.ts](verifier/src/index.ts)

Student tasks:
- implement `/credential-offers`
- implement `/token`
- implement `/credential` for `vc+sd-jwt`
- enforce `Authorization: Bearer <access_token>`
- enforce `c_nonce` by checking `proof.jwt`
- sign the SD-JWT and return the combined `sd_jwt~disclosures`
- verify the SD-JWT in the verifier against issuer JWKS

Commands:

```bash
pnpm lab:check -- --lab 01 --start --verbose
```

Useful manual flow:

```bash
curl -s -X POST http://localhost:3001/credential-offers \
  -H 'content-type: application/json' \
  -d '{"credentials":["AgeCredential"]}' | jq

curl -s -X POST http://localhost:3001/token \
  -H 'content-type: application/json' \
  -d '{"grant_type":"urn:ietf:params:oauth:grant-type:pre-authorized_code","pre_authorized_code":"<code>"}' | jq
```

What the checker expects:
- offer creation works
- token exchange works
- SD-JWT issuance works
- `/verify` returns `ok: true`

Questions already answered:
- "Can the proof JWT use `alg=none` in the lab?" Yes. The lesson focuses on server behavior, not production wallet keys.
- "Which claims matter?" The lab uses `age_over` and `residency`.

## Lesson 02

Goal:
- add DI+BBS issuance
- derive and verify a selective disclosure proof

Student edits:
- [issuer/src/index.ts](issuer/src/index.ts)
- [verifier/src/index.ts](verifier/src/index.ts)
- [bbs-lib/src/index.ts](bbs-lib/src/index.ts)

Student tasks:
- add `AgeCredentialBBS` to issuer support
- issue a BBS credential in `/credential`
- return `signature`, `messages`, `publicKey`, `credentialStatus`, and reveal indices
- implement `/bbs/proof`
- verify the BBS proof in the verifier

Commands:

```bash
pnpm lab:check -- --lab 02 --start --verbose
```

What the checker expects:
- BBS issuance works
- the proof derivation helper works
- the verifier accepts a proof that reveals only `age_over`

Important integrated-repo note:
- In final integrated mode, BBS verification can also involve iProov.
- In lesson mode with `LAB_ID=02`, that extra requirement is switched off on purpose.
- Students should not be pulled into iProov during the BBS lesson.

Questions already answered:
- "Why does Lab 02 not ask for iProov?" Because this lesson is about selective disclosure, not liveness.
- "Why does changing reveal indices break verification?" Because the message order and the revealed indices must match the original signature inputs.

## Lesson 03

Goal:
- prove that issuer and verifier outbound requests can go through an OHTTP relay

Student edits:
- `issuer/.env`
- `verifier/.env`
- optionally relay code in `ohttp/`

Student tasks:
- set `USE_OHTTP=true`
- set `OHTTP_RELAY_URL`
- make sure outbound fetches honor those env vars
- rerun the normal SD-JWT flow and confirm relay use

Commands:

```bash
pnpm lab:check -- --lab 03 --start --verbose
```

What the checker expects:
- a relay stub is started locally
- issuer and verifier route outbound fetches through that relay
- the relay receives traffic during verification

Questions already answered:
- "Do I need a real Cloudflare relay in class?" No. The local lab check can use the relay stub.
- "Why did nothing change after editing `.env`?" Because the student probably forgot to restart the dev servers.

## Lesson 04

Goal:
- add an iProov-backed liveness gate

Student edits:
- [issuer/src/index.ts](issuer/src/index.ts)
- optionally wallet hook files for the advanced mobile track

Student tasks:
- implement `GET /iproov/claim`
- implement `POST /iproov/webhook`
- persist a liveness result keyed by session
- block the flow until the session is marked passed

Commands:

```bash
pnpm lab:check -- --lab 04 --start --verbose
```

What the checker expects:
- `/credential` fails with `403 requires_liveness` before the webhook pass
- the same flow succeeds after the webhook marks the session passed

Important integrated-repo note:
- In the final integrated repo, issuance is not always the default iProov enforcement point.
- In lesson mode with `LAB_ID=04`, issuance-time gating is restored on purpose so the student can learn the liveness gate directly.

Questions already answered:
- "Do students need real iProov credentials for the core lesson?" No. The core lesson can be taught with the demo-mode webhook path.
- "Is the wallet mandatory for Lab 04?" No. The wallet is the advanced/mobile extension of the same idea.

## Lesson 05

Goal:
- add revocation with a Bitstring Status List

Student edits:
- [issuer/src/index.ts](issuer/src/index.ts)
- [verifier/src/index.ts](verifier/src/index.ts)
- status list utilities under [status-list](status-list)

Student tasks:
- generate the status list file
- serve `/statuslist/:id.json`
- embed `credentialStatus` in issued credentials
- check the status list during verification
- add `/revoke/:id` guarded by `ADMIN_TOKEN`

Commands:

```bash
pnpm --filter status-list run generate
pnpm lab:check -- --lab 05 --start --verbose
```

What the checker expects:
- verification succeeds before revocation
- `/revoke/:id` flips the relevant bit
- verification fails after revocation

Questions already answered:
- "Why does the verifier still pass after revocation?" Usually because the student forgot to reload the list or never checked the bit.
- "Why does `/revoke` return unauthorized?" Because `ADMIN_TOKEN` is missing or the `x-admin-token` header does not match it.

## What Students Should Not Do

- Do not rewrite `demo-conductor/` to pass a lesson.
- Do not make the wallet repo a dependency of the core Node lesson flow.
- Do not force iProov into Lab 02.
- Do not assume `main` without `LAB_ID` behaves like the lesson handout branch.
- Do not move mobile source into `LearningLab`.

## Instructor Short Answers

- "Should students use `main` or lesson branches?"
  Use `main` plus `LAB_ID` for grading. The old branch handouts are historical teaching material.

- "Should students use `demo-conductor` during the labs?"
  No. Use `pnpm dev` and `pnpm lab:check`.

- "Should students integrate the wallet to pass the core labs?"
  No. The wallet is the advanced/mobile track.

- "Why does the repo talk about both browser iProov and wallet iProov?"
  Because the booth demo uses the browser path while the mobile track uses the wallet path. They must coexist without breaking each other.

- "Which files should a TA inspect first when a lesson fails?"
  Start with [issuer/src/index.ts](issuer/src/index.ts), [verifier/src/index.ts](verifier/src/index.ts), and [scripts/lab-check.js](scripts/lab-check.js).
