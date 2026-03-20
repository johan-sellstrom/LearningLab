import assert from 'node:assert/strict'
import test from 'node:test'
import { assertPassedIProovSession, fetchIProovSession } from '../src/iproov.ts'

test('fetchIProovSession reads issuer session state', async () => {
  let requestedUrl = ''

  const record = await fetchIProovSession('https://issuer.example.com', 'session-123', async (input) => {
    requestedUrl = String(input)
    return new Response(JSON.stringify({
      ok: true,
      session: 'session-123',
      passed: true,
      mode: 'real',
      validatedAt: '2026-03-17T12:00:00.000Z',
      reason: null
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })
  })

  assert.equal(requestedUrl, 'https://issuer.example.com/iproov/session/session-123')
  assert.deepEqual(record, {
    session: 'session-123',
    passed: true,
    mode: 'real',
    validatedAt: '2026-03-17T12:00:00.000Z',
    reason: null
  })
})

test('assertPassedIProovSession rejects an unvalidated session', async () => {
  await assert.rejects(
    assertPassedIProovSession('https://issuer.example.com', 'session-456', async () => new Response(JSON.stringify({
      ok: true,
      session: 'session-456',
      passed: false,
      mode: 'real',
      validatedAt: '2026-03-17T12:05:00.000Z',
      reason: 'face_not_centered'
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    })),
    /face_not_centered/
  )
})

test('assertPassedIProovSession surfaces missing sessions', async () => {
  await assert.rejects(
    assertPassedIProovSession('https://issuer.example.com', 'missing-session', async () => new Response(JSON.stringify({
      error: 'unknown_session'
    }), {
      status: 404,
      headers: { 'content-type': 'application/json' }
    })),
    /Unknown iProov session/
  )
})
