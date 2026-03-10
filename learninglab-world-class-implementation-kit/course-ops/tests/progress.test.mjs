import test from 'node:test'
import assert from 'node:assert/strict'
import { getNextLabId, summarizeRepoProgress } from '../src/lib/progress.mjs'

test('getNextLabId advances through the known lab sequence', () => {
  assert.equal(getNextLabId('00'), '01')
  assert.equal(getNextLabId('04'), '05')
  assert.equal(getNextLabId('05'), null)
  assert.equal(getNextLabId('unknown'), null)
})

test('summarizeRepoProgress marks successful repos as ready for the next lab', () => {
  const summary = summarizeRepoProgress({
    repo: 'acme/learninglab-lab-01-ada',
    currentLabId: '01',
    latestRun: {
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/acme/learninglab-lab-01-ada/actions/runs/123'
    }
  })

  assert.equal(summary.currentLabId, '01')
  assert.equal(summary.nextLabId, '02')
  assert.equal(summary.workflowState, 'success')
  assert.equal(summary.readyToAdvance, true)
  assert.equal(summary.runUrl, 'https://github.com/acme/learninglab-lab-01-ada/actions/runs/123')
})

test('summarizeRepoProgress keeps failed or missing repos on the current lab', () => {
  const missing = summarizeRepoProgress({
    repo: 'acme/learninglab-lab-02-ada',
    currentLabId: '02',
    latestRun: null
  })
  const failed = summarizeRepoProgress({
    repo: 'acme/learninglab-lab-02-ada',
    currentLabId: '02',
    latestRun: {
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://github.com/acme/learninglab-lab-02-ada/actions/runs/456'
    }
  })

  assert.equal(missing.readyToAdvance, false)
  assert.equal(missing.workflowState, 'missing')
  assert.equal(missing.nextLabId, '03')

  assert.equal(failed.readyToAdvance, false)
  assert.equal(failed.workflowState, 'failure')
  assert.equal(failed.nextLabId, '03')
})
