import test from 'node:test'
import assert from 'node:assert/strict'
import { summarizeProvisioningRoster, hasBlockingProvisioningIssues } from '../src/lib/roster.mjs'
import { renderPlanMarkdown } from '../src/lib/strings.mjs'

test('summarizeProvisioningRoster reports duplicates and missing Google ids', () => {
  const summary = summarizeProvisioningRoster([
    {
      studentName: 'Ada Lovelace',
      studentEmail: 'ada@example.edu',
      githubUsername: 'adalovelace',
      googleUserId: null
    },
    {
      studentName: 'Ada Clone',
      studentEmail: 'ada@example.edu',
      githubUsername: 'adalovelace',
      googleUserId: '100'
    }
  ])

  assert.equal(hasBlockingProvisioningIssues(summary), true)
  assert.deepEqual(summary.blockingIssues.duplicateStudentEmails, ['ada@example.edu'])
  assert.deepEqual(summary.blockingIssues.duplicateGitHubUsernames, ['adalovelace'])
  assert.equal(summary.counts.missingGoogleUserIds, 1)
})

test('renderPlanMarkdown includes Google roster state and blocking issues', () => {
  const roster = [
    {
      studentName: 'Ada Lovelace',
      studentEmail: 'ada@example.edu',
      githubUsername: 'adalovelace',
      googleUserId: null,
      repoName: 'learninglab-lab-01-issuance-adalovelace'
    }
  ]
  const rosterSummary = summarizeProvisioningRoster(roster)

  const markdown = renderPlanMarkdown({
    courseConfig: {
      course: { name: 'Learning Lab 2026' }
    },
    assignment: {
      title: 'Lab 01 — SD-JWT Issuance (OIDC4VCI)',
      id: 'lab-01',
      labId: '01'
    },
    roster,
    repoPlan: roster,
    rosterSummary
  })

  assert.match(markdown, /\| Student \| Email \| GitHub username \| Google user ID \| Repo name \|/)
  assert.match(markdown, /missing/)
  assert.match(markdown, /missing Google user IDs/)
})
