import assert from 'node:assert/strict'
import test from 'node:test'
import {
  normalizeIProovApiBaseUrl,
  normalizeIProovCeremonyBaseUrl,
  requestEnrolToken,
  resolveIProovConfig,
  validateEnrolToken
} from '../src/iproov.ts'

test('resolveIProovConfig normalizes urls and falls back to management key', () => {
  const config = resolveIProovConfig({
    IPROOV_BASE_URL: 'https://eu.rp.iproov.me',
    IPROOV_API_KEY: 'api-key',
    IPROOV_MANAGEMENT_KEY: 'management-secret',
    ISSUER_BASE_URL: 'https://issuer.example.com'
  })

  assert.equal(config.apiBaseUrl, 'https://eu.rp.iproov.me/api/v2')
  assert.equal(config.ceremonyBaseUrl, 'https://eu.rp.iproov.me')
  assert.equal(config.secret, 'management-secret')
  assert.equal(config.resource, 'https://issuer.example.com')
  assert.equal(config.sdkScriptUrl, 'https://cdn.jsdelivr.net/npm/@iproov/web')
  assert.equal(config.realCeremonyEnabled, true)
})

test('resolveIProovConfig ignores placeholder secrets and keeps demo mode disabled', () => {
  const config = resolveIProovConfig({
    IPROOV_BASE_URL: 'https://eu.rp.iproov.me',
    IPROOV_API_KEY: 'replace_with_api_key',
    IPROOV_SECRET: 'replace_with_secret',
    IPROOV_MANAGEMENT_KEY: '<management-key>'
  })

  assert.equal(config.apiKey, null)
  assert.equal(config.secret, null)
  assert.equal(config.realCeremonyEnabled, false)
})

test('normalizeIProov base url helpers accept raw platform or api urls', () => {
  assert.equal(normalizeIProovApiBaseUrl('https://eu.rp.iproov.me/api/v2/'), 'https://eu.rp.iproov.me/api/v2')
  assert.equal(normalizeIProovApiBaseUrl('https://eu.rp.iproov.me'), 'https://eu.rp.iproov.me/api/v2')
  assert.equal(normalizeIProovCeremonyBaseUrl('https://eu.rp.iproov.me/api/v2/'), 'https://eu.rp.iproov.me')
})

test('requestEnrolToken posts the expected payload', async () => {
  let url = ''
  let body = ''
  const config = resolveIProovConfig({
    IPROOV_API_KEY: 'api-key',
    IPROOV_SECRET: 'secret-key'
  })

  const response = await requestEnrolToken(config, { userId: 'user-123' }, async (input, init) => {
    url = String(input)
    body = String(init?.body || '')
    return new Response(JSON.stringify({ token: 'enrol-token' }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })

  assert.equal(url, 'https://eu.rp.iproov.me/api/v2/claim/enrol/token')
  assert.match(body, /"user_id":"user-123"/)
  assert.match(body, /"assurance_type":"genuine_presence"/)
  assert.equal(response.token, 'enrol-token')
})

test('validateEnrolToken parses the validation response', async () => {
  const config = resolveIProovConfig({
    IPROOV_API_KEY: 'api-key',
    IPROOV_SECRET: 'secret-key'
  })

  const result = await validateEnrolToken(config, { userId: 'user-123', token: 'enrol-token', ip: '203.0.113.10' }, async (_input, init) => {
    assert.match(String(init?.body || ''), /"ip":"203.0.113.10"/)
    return new Response(JSON.stringify({
      passed: true,
      token: 'enrol-token',
      type: 'genuine_presence',
      assurance_type: 'genuine_presence',
      signals: {
        matching: {
          passed: true
        }
      }
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })

  assert.equal(result.passed, true)
  assert.equal(result.assuranceType, 'genuine_presence')
  assert.deepEqual(result.signals, {
    matching: {
      passed: true
    }
  })
})
