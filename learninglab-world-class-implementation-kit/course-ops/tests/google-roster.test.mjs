import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeGoogleRoster } from '../src/lib/roster.mjs'

test('normalizeGoogleRoster returns a stable student roster sorted by email', () => {
  const roster = normalizeGoogleRoster([
    {
      userId: '200',
      profile: {
        emailAddress: 'Grace@example.com',
        name: { fullName: 'Grace Hopper' }
      }
    },
    {
      userId: '100',
      profile: {
        emailAddress: 'ada@example.com',
        name: { fullName: 'Ada Lovelace' }
      }
    }
  ])

  assert.deepEqual(roster, [
    {
      googleUserId: '100',
      studentName: 'Ada Lovelace',
      studentEmail: 'ada@example.com'
    },
    {
      googleUserId: '200',
      studentName: 'Grace Hopper',
      studentEmail: 'grace@example.com'
    }
  ])
})

test('normalizeGoogleRoster fails closed when email scope is missing', () => {
  assert.throws(
    () => normalizeGoogleRoster([
      {
        userId: '300',
        profile: {
          name: { fullName: 'No Email Student' }
        }
      }
    ]),
    /classroom\.profile\.emails/
  )
})

test('normalizeGoogleRoster fails closed when full name is missing', () => {
  assert.throws(
    () => normalizeGoogleRoster([
      {
        userId: '400',
        profile: {
          emailAddress: 'student@example.com'
        }
      }
    ]),
    /profile\.name\.fullName/
  )
})
