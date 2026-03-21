import assert from 'node:assert/strict'
import test from 'node:test'
import {
  evaluateCredentialIssuanceIProovGate,
  shouldRequireIProovForCredentialIssuance
} from '../src/lab-compat.ts'

test('Lab 04 requires an iProov session before credential issuance', () => {
  assert.equal(shouldRequireIProovForCredentialIssuance('04'), true)
  assert.deepEqual(
    evaluateCredentialIssuanceIProovGate({
      labId: '04',
      providedSession: false
    }),
    { allowed: false, reason: 'requires_liveness' }
  )
})

test('Integrated mode does not require an issuance-time iProov session by default', () => {
  assert.equal(shouldRequireIProovForCredentialIssuance(undefined), false)
  assert.deepEqual(
    evaluateCredentialIssuanceIProovGate({
      labId: undefined,
      providedSession: false
    }),
    { allowed: true }
  )
})

test('Provided iProov sessions must be passed before issuance continues', () => {
  assert.deepEqual(
    evaluateCredentialIssuanceIProovGate({
      labId: '05',
      providedSession: true,
      passedSession: false
    }),
    { allowed: false, reason: 'requires_liveness' }
  )
  assert.deepEqual(
    evaluateCredentialIssuanceIProovGate({
      labId: '05',
      providedSession: true,
      passedSession: true
    }),
    { allowed: true }
  )
})
