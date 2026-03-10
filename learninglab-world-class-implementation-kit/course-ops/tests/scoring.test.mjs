import test from 'node:test'
import assert from 'node:assert/strict'
import { classifyWorkflowRun, scoreWorkflowRun } from '../src/lib/scoring.mjs'

const grading = {
  successScorePercent: 100,
  failureScorePercent: 0,
  inProgressScorePercent: 50,
  missingRunScorePercent: 0,
  publishAssignedGrades: false
}

test('maps success to full credit', () => {
  const result = scoreWorkflowRun({
    run: { status: 'completed', conclusion: 'success' },
    maxPoints: 100,
    grading
  })
  assert.equal(result.draftGrade, 100)
  assert.equal(result.assignedGrade, null)
})

test('maps in-progress to partial credit', () => {
  const result = scoreWorkflowRun({
    run: { status: 'in_progress', conclusion: null },
    maxPoints: 100,
    grading
  })
  assert.equal(result.draftGrade, 50)
})

test('maps failure to zero by default', () => {
  const result = scoreWorkflowRun({
    run: { status: 'completed', conclusion: 'failure' },
    maxPoints: 100,
    grading
  })
  assert.equal(result.draftGrade, 0)
})

test('classifyWorkflowRun distinguishes missing runs from in-progress runs', () => {
  const missing = classifyWorkflowRun(null)
  const inProgress = classifyWorkflowRun({ status: 'queued', conclusion: null })

  assert.equal(missing.state, 'missing')
  assert.match(missing.reason, /No workflow run found/)
  assert.equal(inProgress.state, 'in_progress')
  assert.match(inProgress.reason, /queued/)
})
