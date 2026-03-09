#!/usr/bin/env node
/*
 * Soft lab verifier for Classroom/autograding and local checks.
 *
 * Design goals and rationale:
 * - Keep grading "soft": we validate expected API behavior and flows without
 *   requiring cryptographic keys or real wallets. This lowers setup friction.
 * - Auto-start services if they are not already running so CI can succeed and
 *   local learners can run a single command without manual orchestration.
 * - Support multiple lab IDs (00-05) to match the lab progression branches.
 */

const { spawn } = require('node:child_process')
const http = require('node:http')
const { setTimeout: sleep } = require('node:timers/promises')
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
// Defaults point at the dev servers used by `pnpm dev`. Allow override so CI
// or advanced users can point at remote or already-running services.
const DEFAULT_ISSUER = process.env.ISSUER_BASE_URL || 'http://localhost:3001'
const DEFAULT_VERIFIER = process.env.VERIFIER_BASE_URL || 'http://localhost:3002'

// Parse CLI args for lab selection and service-start control.
const args = parseArgs(process.argv.slice(2))
// Branch-based inference keeps the workflow simple: lab-01-* => 01, etc.
const inferredLab = inferLabId()
// Resolve lab ID precedence: explicit --lab, then LAB_ID env, then branch name.
// The repo's main branch currently reflects the final integrated lab state, so
// default to Lab 05 when no branch- or env-specific signal is present.
const labId = normalizeLabId(args.lab || process.env.LAB_ID || inferredLab || '05')
const verbose = Boolean(args.verbose)

let issuerProc = null
let verifierProc = null
let relayServer = null
let relayHits = []
// Track whether we started the services so we can adjust expectations in
// lab checks (e.g., OHTTP env validation vs. live relay probing).
let startedServices = false

main()
  .catch((err) => {
    console.error('[lab-check] FAILED:', err?.message || err)
    process.exitCode = 1
  })
  .finally(async () => {
    await cleanup()
  })

async function main() {
  // Decide whether to start issuer/verifier locally. In CI, they are not
  // running yet, so we usually start them. If they are already up, we avoid
  // spawning duplicates and instead reuse the running services.
  const shouldStart = await decideStart()
  if (shouldStart) {
    startedServices = true
    await startServices()
  }

  // Wait for services to be reachable before running lab checks.
  await waitForService(`${DEFAULT_ISSUER}/.well-known/openid-credential-issuer`, 'issuer')
  await waitForService(`${DEFAULT_VERIFIER}/`, 'verifier')

  const runner = LAB_RUNNERS[labId]
  if (!runner) {
    throw new Error(`Unknown lab id: ${labId}. Use 00, 01, 02, 03, 04, 05.`)
  }

  if (verbose) console.log(`[lab-check] Running lab ${labId} checks...`)
  await runner()

  console.log(`[lab-check] PASS lab ${labId}`)
}

// Map lab IDs to their specific grading flows.
const LAB_RUNNERS = {
  '00': checkLab00,
  '01': checkLab01,
  '02': checkLab02,
  '03': checkLab03,
  '04': checkLab04,
  '05': checkLab05
}

async function checkLab00() {
  // Lab 00 is a baseline smoke test: the services should be reachable and
  // basic endpoints should respond without 5xx. We do not validate crypto
  // here because the goal is to confirm the dev servers are wired up.
  await expectStatus(`${DEFAULT_ISSUER}/.well-known/openid-credential-issuer`, 200)

  const offer = await postJson(`${DEFAULT_ISSUER}/credential-offers`, { credentials: ['AgeCredential'] })
  assertLab00Endpoint('/credential-offers', offer.status)

  const token = await postJson(`${DEFAULT_ISSUER}/token`, { grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code' })
  assertLab00Endpoint('/token', token.status)

  const credential = await postJson(`${DEFAULT_ISSUER}/credential`, { format: 'vc+sd-jwt', claims: { age_over: 21 } })
  assertLab00Endpoint('/credential', credential.status)

  const verify = await postJson(`${DEFAULT_VERIFIER}/verify`, { credential: 'stub' })
  assertLab00Endpoint('/verify', verify.status)
}

function assertLab00Endpoint(endpoint, status) {
  // Lab 00 starter branches intentionally return 501 for unimplemented
  // handlers. We accept that here while still failing on unexpected 5xxs.
  if (status >= 500 && status !== 501) {
    throw new Error(`${endpoint} failed`)
  }
}

async function checkLab01() {
  // Lab 01 validates SD-JWT VC issuance and verification end-to-end using
  // the issuer and verifier services. We treat "ok" as the success signal
  // to keep the grading resilient to formatting differences.
  const flow = await issueSdJwtFlow({ credentialId: 'AgeCredential' })
  const verify = await postJson(`${DEFAULT_VERIFIER}/verify`, { format: 'vc+sd-jwt', credential: flow.credential })
  if (!verify.json?.ok) throw new Error('SD-JWT verify failed')
}

async function checkLab02() {
  // Lab 02 validates BBS+ issuance and selective disclosure proof derivation.
  // We first ask the issuer for a BBS credential, then derive a proof, then
  // confirm the verifier accepts it.
  const flow = await issueBbsFlow()
  const proof = await postJson(`${DEFAULT_ISSUER}/bbs/proof`, {
    signature: flow.signature,
    messages: flow.messages,
    reveal: [1],
    nonce: flow.nonce
  })
  if (!proof.json?.proof) throw new Error('BBS proof derivation failed')

  const verify = await postJson(`${DEFAULT_VERIFIER}/verify`, {
    format: 'di-bbs',
    proof: {
      proof: proof.json.proof,
      revealedMessages: proof.json.revealedMessages,
      nonce: proof.json.nonce
    },
    credentialStatus: flow.credentialStatus
  })
  if (!verify.json?.ok) throw new Error('BBS proof verification failed')
}

async function checkLab03() {
  // Lab 03 ensures OHTTP routing is enabled. If we did not start the services,
  // we cannot observe live relay traffic, so we fall back to env validation.
  if (!startedServices) {
    // Fallback to env file check if we didn't start the services.
    const issuerEnv = readEnv(path.join(ROOT, 'issuer/.env'))
    const verifierEnv = readEnv(path.join(ROOT, 'verifier/.env'))
    if (issuerEnv.USE_OHTTP !== 'true' || verifierEnv.USE_OHTTP !== 'true') {
      throw new Error('USE_OHTTP must be true in issuer/.env and verifier/.env (or run with --start)')
    }
    if (!issuerEnv.OHTTP_RELAY_URL || !verifierEnv.OHTTP_RELAY_URL) {
      throw new Error('OHTTP_RELAY_URL must be set in issuer/.env and verifier/.env (or run with --start)')
    }
    return
  }

  relayHits = []
  const flow = await issueSdJwtFlow({ credentialId: 'AgeCredential' })
  await postJson(`${DEFAULT_VERIFIER}/verify`, { format: 'vc+sd-jwt', credential: flow.credential })
  // If the relay server was not hit, then the request likely bypassed OHTTP.
  if (relayHits.length === 0) throw new Error('OHTTP relay was not used (no relay hits captured)')
}

async function checkLab04() {
  // Lab 04 validates liveness gating. The issuer should refuse to issue
  // until an iProov signal indicates a successful match.
  const offer = await createOffer(['AgeCredential'])
  const token = await exchangeToken(offer.code)

  const cNonce = token.c_nonce
  const proofJwt = makeUnsignedJwt({ nonce: cNonce, aud: `${DEFAULT_ISSUER}/credential` })
  const blocked = await postJson(
    `${DEFAULT_ISSUER}/credential`,
    {
      format: 'vc+sd-jwt',
      claims: { age_over: 21, residency: 'SE' },
      proof: { proof_type: 'jwt', jwt: proofJwt }
    },
    { authorization: `Bearer ${token.access_token}` }
  )

  if (blocked.status !== 403 || blocked.json?.error !== 'requires_liveness') {
    throw new Error('Expected issuance to be blocked until iProov passes')
  }

  // Simulate the iProov webhook callback by sending a "passed" signal.
  const session = await ensureIproovSession()
  if (!session) throw new Error('iProov session endpoint missing')
  const passed = await postJson(`${DEFAULT_ISSUER}/iproov/webhook`, {
    session,
    signals: { matching: { passed: true } }
  })
  if (!passed.json?.ok) throw new Error('iProov webhook did not accept the session')

  const ok = await postJson(
    `${DEFAULT_ISSUER}/credential`,
    {
      format: 'vc+sd-jwt',
      claims: { age_over: 21, residency: 'SE' },
      proof: { proof_type: 'jwt', jwt: proofJwt },
      iproov_session: session
    },
    { authorization: `Bearer ${token.access_token}` }
  )

  if (ok.status >= 400 || !ok.json?.credential) {
    throw new Error('Issuance still blocked after iProov pass')
  }
}

async function checkLab05() {
  // Lab 05 validates revocation behavior: the verifier should reject a
  // previously valid credential after the issuer marks it revoked.
  const flow = await issueSdJwtFlow({ credentialId: 'AgeCredential' })

  const verify1 = await postJson(`${DEFAULT_VERIFIER}/verify`, { format: 'vc+sd-jwt', credential: flow.credential })
  if (!verify1.json?.ok) throw new Error('Initial verification failed (expected ok)')

  const revoke = await postJson(`${DEFAULT_ISSUER}/revoke/${flow.credentialId}`, {}, {
    'x-admin-token': process.env.ADMIN_TOKEN || 'lab-admin'
  })

  // If admin token is missing, we explicitly fail to prompt proper setup.
  if (revoke.json?.error === 'admin_token_not_configured') {
    throw new Error('ADMIN_TOKEN not configured for /revoke (set ADMIN_TOKEN or run with --start)')
  }
  if (!revoke.json?.ok) throw new Error('Revocation failed')

  const verify2 = await postJson(`${DEFAULT_VERIFIER}/verify`, { format: 'vc+sd-jwt', credential: flow.credential })
  if (verify2.json?.ok !== false && !String(verify2.json?.error || '').includes('credential_revoked')) {
    throw new Error('Expected verification to fail after revocation')
  }
}

async function issueSdJwtFlow({ credentialId }) {
  // Issue an SD-JWT VC using the standard OID4VCI pre-authorized flow.
  // We intentionally use an unsigned JWT proof (alg=none) because the lab
  // focuses on server behavior rather than wallet key management.
  const offer = await createOffer([credentialId])
  const token = await exchangeToken(offer.code)
  const session = await ensureIproovSession()
  await maybePassIproovSession(session)
  const proofJwt = makeUnsignedJwt({ nonce: token.c_nonce, aud: `${DEFAULT_ISSUER}/credential` })
  const body = {
    format: 'vc+sd-jwt',
    credential_configuration_id: credentialId,
    claims: { age_over: 21, residency: 'SE' },
    proof: { proof_type: 'jwt', jwt: proofJwt }
  }
  if (session) body.iproov_session = session
  const credential = await postJson(`${DEFAULT_ISSUER}/credential`, body, {
    authorization: `Bearer ${token.access_token}`
  })

  if (credential.status >= 400 || !credential.json?.credential) {
    throw new Error(`Credential issuance failed (${credential.status})`)
  }

  return {
    credential: credential.json.credential,
    credentialId: credential.json.credentialId,
    credentialStatus: credential.json.credentialStatus
  }
}

async function issueBbsFlow() {
  // Issue a BBS+ credential and return the material needed for proof derivation.
  const offer = await createOffer(['AgeCredentialBBS'])
  const token = await exchangeToken(offer.code)
  const session = await ensureIproovSession()
  await maybePassIproovSession(session)
  const proofJwt = makeUnsignedJwt({ nonce: token.c_nonce, aud: `${DEFAULT_ISSUER}/credential` })
  const body = {
    format: 'di-bbs',
    credential_configuration_id: 'AgeCredentialBBS',
    claims: { age_over: 25, residency: 'SE' },
    proof: { proof_type: 'jwt', jwt: proofJwt }
  }
  if (session) body.iproov_session = session
  const credential = await postJson(`${DEFAULT_ISSUER}/credential`, body, {
    authorization: `Bearer ${token.access_token}`
  })

  if (credential.status >= 400 || !credential.json?.signature) {
    throw new Error(`BBS credential issuance failed (${credential.status})`)
  }

  return {
    signature: credential.json.signature,
    messages: credential.json.messages,
    nonce: credential.json.nonce || 'bbs-demo-nonce',
    credentialStatus: credential.json.credentialStatus
  }
}

async function createOffer(credentials) {
  // Create a pre-authorized credential offer to keep the flow headless
  // (no interactive OAuth needed in CI or during labs).
  const res = await postJson(`${DEFAULT_ISSUER}/credential-offers`, { credentials })
  if (res.status >= 400) throw new Error('credential offer failed')
  const code = res.json?.credential_offer?.grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code']
  if (!code) throw new Error('missing pre-authorized code')
  return { code }
}

async function exchangeToken(code) {
  // Exchange the pre-authorized code for an access token + c_nonce, which
  // the issuer uses to bind proof of possession for the credential request.
  const res = await postJson(`${DEFAULT_ISSUER}/token`, {
    grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
    pre_authorized_code: code
  })
  if (res.status >= 400) throw new Error('token exchange failed')
  if (!res.json?.access_token || !res.json?.c_nonce) throw new Error('token response missing fields')
  return res.json
}

async function ensureIproovSession() {
  // iProov is optional in earlier labs; if the endpoint is not present we
  // treat it as disabled rather than failing the lab.
  const res = await getJson(`${DEFAULT_ISSUER}/iproov/claim`)
  if (res.status === 404 || res.status === 501) return null
  if (res.status >= 400) throw new Error('iproov claim failed')
  const session = res.json?.session
  if (!session) throw new Error('iproov session missing')
  return session
}

async function maybePassIproovSession(session) {
  // Later integrated labs require the session to be marked passed before
  // issuance. Earlier labs simply return null from ensureIproovSession().
  if (!session) return
  const res = await postJson(`${DEFAULT_ISSUER}/iproov/webhook`, {
    session,
    signals: { matching: { passed: true } }
  })
  if (res.status >= 400 || !res.json?.ok) throw new Error('iproov webhook did not accept the session')
}

function makeUnsignedJwt(payload) {
  // Use alg=none for lab simplicity. This is NOT production-safe, but it
  // lets us demonstrate nonce/audience binding without real keys.
  const header = { alg: 'none', typ: 'JWT' }
  return `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.`
}

function base64url(input) {
  // Use Node's base64url encoding to match JWT encoding rules.
  return Buffer.from(input).toString('base64url')
}

async function postJson(url, body, headers = {}) {
  // Convenience wrapper for JSON POSTs to reduce boilerplate in lab checks.
  return requestJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body || {})
  })
}

async function getJson(url) {
  // Convenience wrapper for JSON GETs.
  return requestJson(url, { method: 'GET' })
}

async function requestJson(url, init) {
  // Parse the response body as JSON if possible; keep raw text for debugging.
  const res = await fetchWithTimeout(url, init)
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch (_) {
    json = null
  }
  return { status: res.status, json, text }
}

async function fetchWithTimeout(url, init = {}, timeoutMs = 15_000) {
  // Use an abortable fetch to avoid hanging CI jobs indefinitely.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function expectStatus(url, expected) {
  // Simple assertion helper to keep lab checks readable.
  const res = await fetchWithTimeout(url, { method: 'GET' })
  if (res.status !== expected) {
    throw new Error(`Expected ${url} to return ${expected}, got ${res.status}`)
  }
}

async function waitForService(url, name) {
  // Poll for a service to become reachable. We prefer polling over a fixed
  // sleep so the workflow proceeds as soon as the service is ready.
  const startedAt = Date.now()
  const timeout = 30_000
  while (Date.now() - startedAt < timeout) {
    try {
      const res = await fetchWithTimeout(url, { method: 'GET' }, 3_000)
      if (res.ok) return
    } catch (_) {
      // keep waiting
    }
    await sleep(500)
  }
  throw new Error(`${name} did not respond at ${url}`)
}

function parseArgs(argv) {
  // Minimal argument parser to avoid extra dependencies in the lab tooling.
  const out = { lab: null, start: null, verbose: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--verbose') out.verbose = true
    else if (arg === '--start') out.start = true
    else if (arg === '--no-start') out.start = false
    else if (arg.startsWith('--lab=')) out.lab = arg.split('=')[1]
    else if (arg === '--lab') out.lab = argv[i + 1]
  }
  return out
}

function normalizeLabId(raw) {
  // Normalize lab identifiers like "1", "01", or "lab-01-issuance".
  if (!raw) return null
  const v = String(raw).replace(/^lab-?/i, '').trim()
  if (v.length === 1) return `0${v}`
  if (v.length === 2) return v
  if (v.startsWith('00')) return '00'
  if (v.startsWith('01')) return '01'
  if (v.startsWith('02')) return '02'
  if (v.startsWith('03')) return '03'
  if (v.startsWith('04')) return '04'
  if (v.startsWith('05')) return '05'
  return v
}

function inferLabId() {
  // Detect lab ID from common branch naming conventions.
  const ref = process.env.GITHUB_REF_NAME || ''
  if (!ref) return null
  if (ref.includes('lab-00')) return '00'
  if (ref.includes('lab-01')) return '01'
  if (ref.includes('lab-02')) return '02'
  if (ref.includes('lab-03')) return '03'
  if (ref.includes('lab-04')) return '04'
  if (ref.includes('lab-05')) return '05'
  return null
}

async function decideStart() {
  // If --start/--no-start is explicit, respect it. Otherwise, start only
  // if the services are not already running.
  if (args.start === true) return true
  if (args.start === false) return false

  const issuerUp = await isUp(`${DEFAULT_ISSUER}/.well-known/openid-credential-issuer`)
  const verifierUp = await isUp(`${DEFAULT_VERIFIER}/`)
  return !(issuerUp && verifierUp)
}

async function isUp(url) {
  // Short health check used to decide whether to spawn local services.
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' }, 2_000)
    return res.ok
  } catch (_) {
    return false
  }
}

async function startServices() {
  // Clone process.env so we can override defaults for the child processes
  // without mutating the current process environment.
  const env = { ...process.env }
  env.ISSUER_BASE_URL = DEFAULT_ISSUER
  env.VERIFIER_BASE_URL = DEFAULT_VERIFIER
  // Provide stable defaults for labs that depend on admin/iproov tokens.
  env.ADMIN_TOKEN = env.ADMIN_TOKEN || 'lab-admin'
  env.IPROOV_PASS_TOKEN = env.IPROOV_PASS_TOKEN || 'demo-iproov-token'

  if (labId === '03') {
    // For OHTTP lab, we spin up a local relay stub to assert that traffic
    // flows through a relay instead of directly to the verifier.
    const relayPort = await startRelayServer()
    env.USE_OHTTP = 'true'
    env.OHTTP_RELAY_URL = `http://127.0.0.1:${relayPort}`
  }

  // Start issuer and verifier in dev mode so they keep running in CI while
  // checks execute. stdio: 'inherit' surfaces their logs in the Actions UI.
  issuerProc = spawn('pnpm', ['--filter', 'issuer', 'dev'], {
    cwd: ROOT,
    env,
    stdio: 'inherit'
  })
  verifierProc = spawn('pnpm', ['--filter', 'verifier', 'dev'], {
    cwd: ROOT,
    env,
    stdio: 'inherit'
  })

  issuerProc.on('exit', (code) => {
    if (code && code !== 0) console.error(`[lab-check] issuer exited with ${code}`)
  })
  verifierProc.on('exit', (code) => {
    if (code && code !== 0) console.error(`[lab-check] verifier exited with ${code}`)
  })
}

async function startRelayServer() {
  // Minimal relay stub: accepts a "target" query param and forwards the request.
  // This lets us assert that OHTTP configuration is used without requiring
  // an external relay service in CI.
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost')
      const target = url.searchParams.get('target')
      if (!target) {
        res.writeHead(400, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'missing_target' }))
        return
      }
      relayHits.push(target)
      const body = await readBody(req)
      // Forward request to the intended target, omitting hop-by-hop headers.
      const upstream = await fetch(target, {
        method: req.method || 'GET',
        headers: sanitizeHeaders(req.headers),
        body: body.length ? body : undefined
      })
      const buffer = Buffer.from(await upstream.arrayBuffer())
      const headers = Object.fromEntries(upstream.headers.entries())
      res.writeHead(upstream.status, headers)
      res.end(buffer)
    } catch (err) {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'relay_failed', message: err?.message || 'unknown' }))
    }
  })

  const port = await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      resolve(address.port)
    })
  })

  relayServer = server
  if (verbose) console.log(`[lab-check] relay stub listening on ${port}`)
  return port
}

function sanitizeHeaders(headers) {
  // Remove headers that are invalid or misleading when proxying.
  const out = {}
  for (const [key, value] of Object.entries(headers || {})) {
    if (!value) continue
    if (key.toLowerCase() === 'host') continue
    if (key.toLowerCase() === 'content-length') continue
    out[key] = value
  }
  return out
}

function readBody(req) {
  // Buffer the full body so we can forward it upstream.
  return new Promise((resolve) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks)))
  })
}

function readEnv(filePath) {
  // Tiny .env parser to avoid introducing a dependency just for this check.
  try {
    const content = fs.readFileSync(filePath, 'utf8')
    const lines = content.split(/\r?\n/)
    const env = {}
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx === -1) continue
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim()
      env[key] = value.replace(/^"|"$/g, '')
    }
    return env
  } catch (_) {
    return {}
  }
}

async function cleanup() {
  // Ensure child processes and relay server are shut down to avoid leaks,
  // especially important in CI where jobs run in shared runners.
  if (issuerProc) await terminateProcess(issuerProc)
  if (verifierProc) await terminateProcess(verifierProc)
  if (relayServer) await new Promise((resolve) => relayServer.close(resolve))
}

async function terminateProcess(proc) {
  // Attempt graceful shutdown first, then force-kill after a timeout.
  if (proc.killed) return
  proc.kill('SIGTERM')
  const timeout = sleep(5_000).then(() => 'timeout')
  const exited = new Promise((resolve) => proc.on('exit', resolve))
  const result = await Promise.race([timeout, exited])
  if (result === 'timeout') {
    proc.kill('SIGKILL')
  }
}
