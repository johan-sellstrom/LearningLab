import test from 'node:test'
import assert from 'node:assert/strict'

import { renderGitHubIdentityCsv } from '../src/lib/csv.mjs'

test('renderGitHubIdentityCsv emits an editable instructor capture sheet', () => {
  const csv = renderGitHubIdentityCsv([
    {
      studentEmail: 'ada@example.com',
      githubUsername: '',
      googleUserId: '100',
      studentName: 'Ada Lovelace'
    }
  ])

  assert.equal(
    csv,
    'student_email,github_username,google_user_id,student_name\nada@example.com,,100,Ada Lovelace\n'
  )
})
