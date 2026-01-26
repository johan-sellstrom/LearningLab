# Lab 00 — Start (Scaffolding + Health Checks)

Branch: `lab-00-start` · Timebox: 10 minutes

Goal: get the scaffold running, env files in place, and verify the expected 501 stubs before coding.

Prereqs
- Node.js 20+, pnpm installed.
- This branch checked out (`git checkout lab-00-start`).
- Copy env samples: `cp issuer/example.env issuer/.env && cp verifier/example.env verifier/.env`.

Steps
1) Install deps: `pnpm install -r`.
2) Start services: `pnpm dev` (Issuer on :3001, Verifier on :3002).
3) Hit metadata: `curl http://localhost:3001/.well-known/openid-credential-issuer` (should return issuer metadata if present; credential endpoints will be stubs).
4) Confirm stubs return 501:  
   - `curl -i -X POST http://localhost:3001/credential-offers -d '{}' -H 'content-type: application/json'`  
   - `curl -i -X POST http://localhost:3001/token -d '{}' -H 'content-type: application/json'`  
   - `curl -i -X POST http://localhost:3001/credential -d '{}' -H 'content-type: application/json'`  
   - `curl -i -X POST http://localhost:3002/verify -d '{}' -H 'content-type: application/json'`
5) Open the annotated code for reference during the lab: `issuer/src/index.ts`, `verifier/src/index.ts`, `bbs-lib/src/index.ts` (comments describe the intended flow).

Pass criteria
- Servers boot without errors.
- Credential/verify endpoints still return 501 (to be implemented in later labs).

Troubleshooting
- Port in use: edit `ISSUER_PORT` / `VERIFIER_PORT` in `.env` files to avoid conflicts.
- pnpm missing: install from https://pnpm.io/installation.
- If metadata endpoint 404s, ensure you are on the correct branch and the dev servers are running. 
