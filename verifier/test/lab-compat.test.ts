import assert from 'node:assert/strict'
import test from 'node:test'
import { shouldRequireIProovForBbsVerification } from '../src/lab-compat.ts'

test('Lab 02 keeps BBS verification compatible without an iProov session', () => {
  assert.equal(shouldRequireIProovForBbsVerification('02'), false)
})

test('Integrated mode and later labs still require BBS iProov verification', () => {
  assert.equal(shouldRequireIProovForBbsVerification(undefined), true)
  assert.equal(shouldRequireIProovForBbsVerification('05'), true)
})
