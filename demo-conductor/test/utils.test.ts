import assert from 'node:assert/strict'
import test from 'node:test'
import { createUnsignedProofJwt, isAllowedRelayTarget, normalizeGitHubUrl, resolveRepoUrl, waitFor } from '../src/utils.ts'

test('createUnsignedProofJwt encodes a nonce-bearing payload', () => {
  const token = createUnsignedProofJwt({ nonce: 'abc123', aud: 'http://localhost:3001/credential' })
  const parts = token.split('.')
  assert.equal(parts.length, 3)

  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  assert.equal(payload.nonce, 'abc123')
  assert.equal(payload.aud, 'http://localhost:3001/credential')
})

test('isAllowedRelayTarget only allows explicit localhost origins', () => {
  const allowedOrigins = ['http://localhost:3001', 'http://localhost:3002']
  assert.equal(isAllowedRelayTarget('http://localhost:3001/.well-known/jwks.json', allowedOrigins), true)
  assert.equal(isAllowedRelayTarget('http://localhost:9999/admin', allowedOrigins), false)
  assert.equal(isAllowedRelayTarget('file:///etc/passwd', allowedOrigins), false)
})

test('normalizeGitHubUrl converts SSH and HTTPS remotes to clean repo URLs', () => {
  assert.equal(normalizeGitHubUrl('git@github.com:advatar/LearningLab.git'), 'https://github.com/advatar/LearningLab')
  assert.equal(normalizeGitHubUrl('https://github.com/advatar/LearningLab.git'), 'https://github.com/advatar/LearningLab')
  assert.equal(normalizeGitHubUrl('not-a-remote'), null)
})

test('resolveRepoUrl prefers explicit configuration over git metadata', () => {
  assert.equal(
    resolveRepoUrl('https://example.com/custom-repo', 'git@github.com:advatar/LearningLab.git'),
    'https://example.com/custom-repo'
  )
  assert.equal(
    resolveRepoUrl('', 'git@github.com:advatar/LearningLab.git'),
    'https://github.com/advatar/LearningLab'
  )
})

test('waitFor aborts promptly when the signal is cancelled', async () => {
  const controller = new AbortController()
  setTimeout(() => controller.abort('stop waiting'), 20)

  await assert.rejects(
    waitFor(() => false, {
      intervalMs: 200,
      timeoutMs: 1_000,
      signal: controller.signal
    }),
    (error: any) => error?.name === 'AbortError'
  )
})
