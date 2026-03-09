import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptUrl = pathToFileURL(path.join(__dirname, '..', 'scripts', 'classroom-progress.js')).href
const mod = await import(scriptUrl)
const api = mod.default ?? mod

test('parseArgs supports workflow, csv, ready filtering, and json output', () => {
  const args = api.parseArgs([
    '--repo',
    'advatar/student-one',
    '--classroom-csv',
    'accepted_assignments.csv',
    '--workflow',
    'classroom.yml',
    '--only-ready',
    '--json'
  ])

  assert.deepEqual(args, {
    repos: ['advatar/student-one'],
    reposFile: null,
    classroomCsv: 'accepted_assignments.csv',
    workflow: 'classroom.yml',
    onlyReady: true,
    json: true,
    help: false
  })
})

test('getNextLabId returns the next unlock step', () => {
  assert.equal(api.getNextLabId('01'), '02')
  assert.equal(api.getNextLabId('04'), '05')
  assert.equal(api.getNextLabId('05'), null)
  assert.equal(api.getNextLabId('bogus'), null)
})

test('summarizeRepoProgress marks successful intermediate labs as ready', () => {
  const summary = api.summarizeRepoProgress(
    'advatar/student-one',
    '02',
    {
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://github.com/advatar/student-one/actions/runs/1'
    },
    null
  )

  assert.deepEqual(summary, {
    repo: 'advatar/student-one',
    currentLabId: '02',
    nextLabId: '03',
    latestStatus: 'completed',
    latestConclusion: 'success',
    readyToAdvance: true,
    reason: 'Latest run passed on main',
    runUrl: 'https://github.com/advatar/student-one/actions/runs/1'
  })
})

test('summarizeRepoProgress blocks final lab, missing LAB_ID, and failures', () => {
  assert.equal(
    api.summarizeRepoProgress('advatar/student-two', '05', {
      status: 'completed',
      conclusion: 'success',
      html_url: 'https://example.test/final'
    }, null).reason,
    'Final lab already reached'
  )

  assert.equal(
    api.summarizeRepoProgress('advatar/student-three', '', null, null).reason,
    'LAB_ID is not set'
  )

  assert.equal(
    api.summarizeRepoProgress('advatar/student-four', '03', {
      status: 'completed',
      conclusion: 'failure',
      html_url: 'https://example.test/failure'
    }, null).readyToAdvance,
    false
  )
})

test('formatProgressTable emits a tab-separated report', () => {
  const table = api.formatProgressTable([
    {
      repo: 'advatar/student-one',
      currentLabId: '01',
      nextLabId: '02',
      readyToAdvance: true,
      latestStatus: 'completed',
      latestConclusion: 'success',
      reason: 'Latest run passed on main',
      runUrl: 'https://example.test/run'
    }
  ])

  assert.match(table, /^repo\tcurrent_lab\tnext_lab\tready\tstatus\tconclusion\treason\trun_url/m)
  assert.match(table, /advatar\/student-one\t01\t02\tyes\tcompleted\tsuccess\tLatest run passed on main\thttps:\/\/example\.test\/run/)
})
