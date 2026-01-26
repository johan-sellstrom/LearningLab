// Lab 01: SD-JWT verifier (no BBS, no OHTTP, no iProov yet).
import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { createHash, randomBytes } from 'node:crypto'
import { decodeJwt, decodeProtectedHeader, importJWK, jwtVerify } from 'jose'
import { base64ToBytes, verifyProof as verifyBbsProof } from 'bbs-lib'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PORT = Number(process.env.VERIFIER_PORT || 3002)
const BASE_URL = process.env.VERIFIER_BASE_URL || `http://localhost:${PORT}`
const ISSUER_BASE_URL = process.env.ISSUER_BASE_URL || 'http://localhost:3001'
const ISSUER_JWKS_URL = process.env.ISSUER_JWKS_URL || `${ISSUER_BASE_URL}/.well-known/jwks.json`
const BBS_KEY_URL = process.env.BBS_KEY_URL || `${ISSUER_BASE_URL}/.well-known/bbs-public-key`
const VP_NONCE_TTL_MS = 5 * 60_000
const USE_OHTTP = String(process.env.USE_OHTTP || 'false') === 'true'
const OHTTP_RELAY_URL = process.env.OHTTP_RELAY_URL || ''
const STATUS_LIST_ID = process.env.STATUS_LIST_ID || '1'
const STATUS_LIST_URL = process.env.STATUS_LIST_URL || `${ISSUER_BASE_URL}/statuslist/${STATUS_LIST_ID}.json`

let lastPresentation: any = null
let cachedJwks: any = null
let cachedBbsPublicKey: Uint8Array | null = null
let cachedStatusList: { bitstringLength: number; encodedList: string; buffer: Buffer } | null = null
const vpNonces = new Map<string, number>()

app.get('/', (_req, res) => {
  res.setHeader('content-type', 'text/html').send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Verifier — Lab 05</title>
  <style>body{font-family:system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 2rem; max-width: 960px; margin: auto;} code{background:#f6f8fa;padding:0.2rem 0.4rem;border-radius:4px}</style>
</head>
<body>
  <h1>Verifier (Lab 05: OHTTP + Revocation)</h1>
  <p>POST <code>/verify</code> with SD-JWT or BBS payloads. Outbound fetches use the relay when <code>USE_OHTTP=true</code>; revocation is enforced via the Bitstring Status List.</p>
</body>
</html>`)
})

app.get('/vp/request', (_req, res) => {
  const nonce = randomBytes(16).toString('base64url')
  vpNonces.set(nonce, Date.now() + VP_NONCE_TTL_MS)
  const request = {
    response_type: 'vp_token',
    response_mode: 'direct_post',
    client_id: BASE_URL,
    nonce,
    presentation_definition: { id: 'lab01', input_descriptors: [] }
  }
  res.json(request)
})

app.post('/verify', async (req, res) => {
  try {
    const format = detectFormat(req.body)
    let result: any
    if (format === 'di-bbs') {
      result = await verifyBbsPresentation(req.body)
    } else {
      const credential = req.body?.credential
      if (typeof credential !== 'string' || !credential.includes('~')) {
        return res.status(400).json({ ok: false, error: 'invalid_credential' })
      }
      result = await verifySdJwtPresentation(req.body)
    }
    lastPresentation = { format, receivedAt: new Date().toISOString(), result, raw: req.body }
    res.json({ ok: true, format, result })
  } catch (e: any) {
    console.error('[verifier] verification error', e)
    res.status(400).json({ ok: false, error: e?.message || 'verify_failed' })
  }
})

app.get('/debug/credential', (_req, res) => {
  res.json({ lastPresentation })
})

app.listen(PORT, () => {
  console.log(
    `[verifier] listening on ${BASE_URL} (Lab 05: OHTTP toggle ${
      USE_OHTTP && OHTTP_RELAY_URL ? `on via ${OHTTP_RELAY_URL}` : 'off'
    })`
  )
})

// --- helpers ---

function detectFormat(body: any) {
  const fmt = String(body?.format || '').toLowerCase()
  if (fmt) return fmt
  if (body?.proof || body?.revealedMessages) return 'di-bbs'
  if (typeof body?.credential === 'string' && body.credential.includes('~')) return 'vc+sd-jwt'
  return 'vc+sd-jwt'
}

async function verifyBbsPresentation(body: any) {
  const proofPayload = body?.proof || {}
  if (typeof proofPayload.proof !== 'string' || !Array.isArray(proofPayload.revealedMessages)) {
    throw new Error('invalid_proof')
  }
  const nonce = proofPayload.nonce || 'bbs-demo-nonce'
  const publicKey = await fetchBbsPublicKey()
  const ok = await verifyBbsProof(base64ToBytes(proofPayload.proof), publicKey, proofPayload.revealedMessages, nonce)
  if (!ok) throw new Error('bbs_proof_failed')
  if (body.credentialStatus) {
    await ensureNotRevoked(body.credentialStatus)
  }
  return { revealedMessages: proofPayload.revealedMessages, nonce }
}

async function verifySdJwtPresentation(body: any) {
  const credential = String(body.credential || '')
  const [sdJwt, ...disclosures] = credential.split('~')
  if (!sdJwt || disclosures.length === 0) throw new Error('missing_disclosures')

  const jwks = await fetchJwks()
  const protectedHeader = decodeProtectedHeader(sdJwt)
  if (!protectedHeader.kid && jwks.keys?.length) {
    protectedHeader.kid = jwks.keys[0].kid
  }
  const key = jwks.keys.find((k: any) => !protectedHeader.kid || k.kid === protectedHeader.kid)
  if (!key) throw new Error('jwks_key_not_found')

  const { payload } = await jwtVerify(sdJwt, await importJWK(key, 'ES256'), {
    audience: [BASE_URL, ISSUER_BASE_URL, `${ISSUER_BASE_URL}/credential`]
  })

  const hashed = disclosures.map((d: string) => hashDisclosure(d))
  const sdArray = (payload as any)._sd || []
  for (const h of hashed) {
    if (!sdArray.includes(h)) throw new Error('disclosure_mismatch')
  }

  const claims: Record<string, any> = {}
  for (const d of disclosures) {
    const [_, name, value] = parseDisclosure(d)
    claims[name] = value
  }

  if ((payload as any).credentialStatus) {
    await ensureNotRevoked((payload as any).credentialStatus)
  }

  return { payload, claims }
}

function hashDisclosure(disclosure: string) {
  return createHash('sha256').update(disclosure).digest('base64url')
}

function parseDisclosure(disclosure: string): [string, string, any] {
  const decoded = Buffer.from(disclosure, 'base64url').toString('utf8')
  const arr = JSON.parse(decoded)
  if (!Array.isArray(arr) || arr.length < 3) {
    throw new Error('invalid_disclosure')
  }
  return arr as [string, string, any]
}

async function fetchJwks() {
  if (cachedJwks) return cachedJwks
  const res = await fetchViaRelay(ISSUER_JWKS_URL)
  if (!res.ok) throw new Error(`jwks_fetch_failed ${res.status}`)
  cachedJwks = await res.json()
  return cachedJwks
}

async function fetchBbsPublicKey() {
  if (cachedBbsPublicKey) return cachedBbsPublicKey
  const res = await fetchViaRelay(BBS_KEY_URL)
  if (!res.ok) throw new Error(`bbs_key_fetch_failed ${res.status}`)
  const json = await res.json()
  if (!json.publicKey) throw new Error('bbs_key_missing')
  cachedBbsPublicKey = base64ToBytes(json.publicKey)
  return cachedBbsPublicKey
}

async function fetchViaRelay(url: string, init?: RequestInit) {
  if (!USE_OHTTP || !OHTTP_RELAY_URL) return fetch(url, init)
  // Simple relay helper: for real OHTTP, point OHTTP_RELAY_URL at your worker.
  return fetch(`${OHTTP_RELAY_URL}?target=${encodeURIComponent(url)}`, init)
}

async function ensureNotRevoked(status: { statusListIndex: string | number; statusListCredential?: string }) {
  const url = status.statusListCredential || STATUS_LIST_URL
  const idx = Number(status.statusListIndex)
  if (Number.isNaN(idx)) return
  const list = await fetchStatusList(url)
  const revoked = isBitSet(list.buffer, idx)
  if (revoked) throw new Error('credential_revoked')
}

async function fetchStatusList(url: string) {
  if (cachedStatusList && url === STATUS_LIST_URL) return cachedStatusList
  const res = await fetchViaRelay(url)
  if (!res.ok) throw new Error(`status_list_fetch_failed ${res.status}`)
  const json = await res.json()
  const buffer = Buffer.from(json.encodedList, 'base64')
  const list = {
    bitstringLength: Number(json.bitstringLength || buffer.length * 8),
    encodedList: String(json.encodedList || ''),
    buffer
  }
  if (url === STATUS_LIST_URL) cachedStatusList = list
  return list
}

function isBitSet(buffer: Buffer, index: number) {
  const byteIndex = Math.floor(index / 8)
  const bitOffset = index % 8
  if (byteIndex >= buffer.length) return false
  return (buffer[byteIndex] & (1 << bitOffset)) > 0
}
