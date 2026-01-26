# Lab 04 — iProov Liveness Gate

Branch: `lab-04-iproov` · Timebox: 20 minutes

Goal: require a successful iProov verification before releasing/presenting credentials.

Prereqs
- Checkout branch: `git checkout lab-04-iproov`.
- iProov sandbox credentials available (use placeholders if demoing).
- Env ready: `cp issuer/example.env issuer/.env && cp verifier/example.env verifier/.env`; set `IPROOV_BASE_URL`, `IPROOV_API_KEY`, `IPROOV_MANAGEMENT_KEY`, `IPROOV_PASS_TOKEN` (for local demo).
- Services running: `pnpm dev`.

Steps (edit + test)
1) Add claim + webhook endpoints
   - In `issuer/src/index.ts`, implement `/iproov/claim` to request/return a token or streaming URL from iProov (mock acceptable for lab; return a signed token or placeholder).
   - Implement `/iproov/webhook`: accept callbacks from iProov, validate a shared secret or header, and persist the result (e.g., in-memory map keyed by session or subject) with `signals.matching.passed`.
2) Gate credential issuance/presentation
   - In `/credential` (or before presentation release), check the stored iProov result; if not passed, respond 403 with `requires_liveness`.
   - On success, proceed with issuance/presentation as in earlier labs.
3) Wallet hook (Swift)
   - In `wallet-ios/README.md` (or Swift patch files), add the snippet:
     ```
     IProov.launch(streamingURL: URL(string: token)!) { event in
       switch event { case .success(_): onResult(true); case .failure(_): onResult(false); default: break }
     }
     ```
   - Ensure the wallet calls `runIProov` before sending the presentation/credential request.
4) Run and test
   - Start services: `pnpm dev`.
   - Request an iProov token: `curl -s http://localhost:3001/iproov/claim | jq`.
   - Simulate webhook pass: `curl -s -X POST http://localhost:3001/iproov/webhook -H 'content-type: application/json' -d '{"session":"<id>","signals":{"matching":{"passed":true}}}'`.
   - Attempt issuance/presentation; expect success only after webhook marks the session passed.

Pass criteria
- Issuance/presentation is blocked until the webhook indicates `passed=true`.
- After a successful webhook call, the same flow succeeds without other code changes.

Troubleshooting
- 403 `requires_liveness`: ensure the webhook payload sets `passed=true` for the correct session/subject.
- Token retrieval errors: verify `IPROOV_*` env vars and that your mock/real iProov API call returns a usable token/URL.
- Webhook validation: if using a secret, confirm headers match between iProov and your handler. 
