import test from 'node:test'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const scriptUrl = pathToFileURL(path.join(__dirname, '..', 'scripts', 'set-lab-id.js')).href
const mod = await import(scriptUrl)
const api = mod.default ?? mod

test('normalizeLabId accepts 00-05 and pads single digits', () => {
  assert.equal(api.normalizeLabId('1'), '01')
  assert.equal(api.normalizeLabId('05'), '05')
  assert.equal(api.normalizeLabId('lab-3'), '03')
})

test('normalizeLabId rejects unsupported values', () => {
  assert.throws(() => api.normalizeLabId('6'), /Invalid lab id/)
  assert.throws(() => api.normalizeLabId('abc'), /Invalid lab id/)
})

test('parseRepoList ignores blanks and comments', () => {
  const repos = api.parseRepoList(`
# comment
advatar/student-one

advatar/student-two
`)

  assert.deepEqual(repos, ['advatar/student-one', 'advatar/student-two'])
})

test('parseArgs supports explicit repo, file, lab, and dry-run', () => {
  const args = api.parseArgs([
    '--repo',
    'advatar/student-one',
    '--repos-file',
    'repos.txt',
    '--classroom-csv',
    'accepted_assignments.csv',
    '--lab',
    '02',
    '--dry-run'
  ])

  assert.deepEqual(args, {
    repos: ['advatar/student-one'],
    reposFile: 'repos.txt',
    classroomCsv: 'accepted_assignments.csv',
    lab: '02',
    dryRun: true,
    help: false
  })
})

test('extractRepoSlug accepts owner/repo and GitHub URLs', () => {
  assert.equal(api.extractRepoSlug('advatar/student-one'), 'advatar/student-one')
  assert.equal(
    api.extractRepoSlug('https://github.com/advatar/student-two'),
    'advatar/student-two'
  )
  assert.equal(
    api.extractRepoSlug('git@github.com:advatar/student-three.git'),
    'advatar/student-three'
  )
  assert.equal(api.extractRepoSlug('not a repo'), null)
})

test('extractReposFromCsv finds repo values in common Classroom-style columns', () => {
  const csv = [
    '"student","assignment repository","starter code repository"',
    '"Ada","https://github.com/advatar/lab-ada","https://github.com/advatar/template"',
    '"Grace","advatar/lab-grace","advatar/template"'
  ].join('\n')

  assert.deepEqual(api.extractReposFromCsv(csv), [
    'advatar/lab-ada',
    'advatar/lab-grace'
  ])
})

test('resolveRepos merges direct repos, repo files, and classroom csv', () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'set-lab-id-'))
  const reposFile = path.join(tmpRoot, 'repos.txt')
  const csvFile = path.join(tmpRoot, 'accepted_assignments.csv')

  fs.writeFileSync(reposFile, 'advatar/student-one\n')
  fs.writeFileSync(
    csvFile,
    [
      'student,assignment repository',
      'Ada,https://github.com/advatar/student-two',
      'Grace,advatar/student-three'
    ].join('\n')
  )

  const repos = api.resolveRepos({
    repos: ['advatar/student-one'],
    reposFile,
    classroomCsv: csvFile
  })

  assert.deepEqual(repos, [
    'advatar/student-one',
    'advatar/student-two',
    'advatar/student-three'
  ])
})
