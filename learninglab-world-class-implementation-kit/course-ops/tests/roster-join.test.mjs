import test from 'node:test'
import assert from 'node:assert/strict'
import { joinGoogleRosterWithGitHubIdentities, hasBlockingJoinIssues } from '../src/lib/roster.mjs'
import { renderRosterCsv } from '../src/lib/csv.mjs'

test('joins Google roster entries to GitHub identities by email or google user id', () => {
  const result = joinGoogleRosterWithGitHubIdentities({
    googleRoster: [
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
    ],
    identities: [
      {
        studentEmail: 'ada@example.com',
        githubUsername: 'adalovelace',
        googleUserId: null,
        studentName: null
      },
      {
        studentEmail: 'mismatch@example.com',
        githubUsername: 'ghopper',
        googleUserId: '200',
        studentName: null
      }
    ]
  })

  assert.equal(hasBlockingJoinIssues(result), false)
  assert.deepEqual(result.matchedRoster, [
    {
      studentName: 'Ada Lovelace',
      studentEmail: 'ada@example.com',
      githubUsername: 'adalovelace',
      googleUserId: '100'
    },
    {
      studentName: 'Grace Hopper',
      studentEmail: 'grace@example.com',
      githubUsername: 'ghopper',
      googleUserId: '200'
    }
  ])
})

test('joinGoogleRosterWithGitHubIdentities reports missing identities and duplicates', () => {
  const result = joinGoogleRosterWithGitHubIdentities({
    googleRoster: [
      {
        googleUserId: '100',
        studentName: 'Ada Lovelace',
        studentEmail: 'ada@example.com'
      },
      {
        googleUserId: '100',
        studentName: 'Ada Clone',
        studentEmail: 'ada@example.com'
      },
      {
        googleUserId: '300',
        studentName: 'No Match',
        studentEmail: 'nomatch@example.com'
      }
    ],
    identities: [
      {
        studentEmail: 'ada@example.com',
        githubUsername: 'adalovelace',
        googleUserId: null,
        studentName: null
      },
      {
        studentEmail: 'duplicate@example.com',
        githubUsername: 'adalovelace',
        googleUserId: null,
        studentName: null
      }
    ]
  })

  assert.equal(hasBlockingJoinIssues(result), true)
  assert.deepEqual(result.blockingIssues.duplicateGoogleEmails, ['ada@example.com'])
  assert.deepEqual(result.blockingIssues.duplicateGoogleUserIds, ['100'])
  assert.deepEqual(result.blockingIssues.duplicateGitHubUsernames, ['adalovelace'])
  assert.deepEqual(result.missingGitHubIdentities, [
    {
      googleUserId: '300',
      studentName: 'No Match',
      studentEmail: 'nomatch@example.com'
    }
  ])
})

test('renderRosterCsv emits the provisioning roster shape', () => {
  const csv = renderRosterCsv([
    {
      studentName: 'Ada Lovelace',
      studentEmail: 'ada@example.com',
      githubUsername: 'adalovelace',
      googleUserId: '100'
    }
  ])

  assert.equal(
    csv,
    'student_name,student_email,github_username,google_user_id\nAda Lovelace,ada@example.com,adalovelace,100\n'
  )
})
