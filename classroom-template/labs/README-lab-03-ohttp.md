# Lab 03 — OHTTP Relay

Branch: `lab-03-ohttp` · Timebox: 20 minutes

Goal: route issuer and verifier calls through an OHTTP relay so servers never see client IPs.

Prereqs
- Checkout branch: `git checkout lab-03-ohttp`.
- Env ready with relay URL placeholders: `pnpm env:setup`.
- Cloudflare account (recommended) or use the local worker stub in `ohttp/`.

Steps (edit + test)
1) Configure the relay
   - If using Cloudflare Privacy Gateway: deploy the worker template in `ohttp/src/index.ts` via `wrangler publish` and note the worker URL (e.g., `https://<name>.workers.dev`).
   - If testing locally: run `pnpm -F ohttp dev` (returns 501 with docs link; sufficient to show routing behavior).
2) Wire issuer to the relay
   - In `issuer/.env`, set `USE_OHTTP=true` and `OHTTP_RELAY_URL=<worker-url>`.
   - Ensure the issuer HTTP client (fetch) respects these toggles (see `issuer/src/index.ts` for the OHTTP section); for the lab, stubbing with a pass-through client is acceptable if the relay is not available.
3) Wire verifier to the relay
   - In `verifier/.env`, set `USE_OHTTP=true` and `OHTTP_RELAY_URL=<worker-url>`.
   - In `verifier/src/index.ts`, ensure outbound fetches (JWKS, status list) go through the relay when the flag is on.
4) Run and observe
   - Start services: `pnpm dev`.
   - Issue and verify a credential (reuse Lab 01/02 curl commands).
   - Check access logs (Cloudflare dashboard or worker logs) to confirm the origin sees relay IPs, not client IPs.
   - If using the stub, confirm requests reach the stub endpoint and are forwarded or rejected as coded.

Pass criteria
- With `USE_OHTTP=true`, issuer/verifier outbound calls are sent via the relay URL.
- Logs show relay IPs (or stub handler confirms receipt), not direct client IPs.

Troubleshooting
- Relay 5xx: verify `OHTTP_RELAY_URL` is correct and the worker is published.
- Requests still going direct: confirm env vars are loaded (restart dev servers after editing `.env`).
- Browser cache: if testing via a browser, hard reload to ensure the new envs are used. 
