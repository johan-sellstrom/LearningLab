import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const ISSUER_FILE = path.join(ROOT, 'issuer', 'src', 'index.ts')

function detectLabStage() {
  const sourceStage = detectSourceStage()
  if (sourceStage != null) return sourceStage

  const explicitStage = normalizeStage(process.env.LAB_STAGE)
  if (explicitStage != null) return explicitStage

  const explicitLabId = normalizeStage(process.env.LAB_ID)
  if (explicitLabId != null) return explicitLabId
  return null
}

function detectSourceStage() {
  const source = readFileSync(ISSUER_FILE, 'utf8')
  const match = source.match(/const LAB_STAGE = (\d+)/)
  return match ? Number(match[1]) : null
}

function normalizeStage(value) {
  if (!value) return null
  const normalized = String(value).match(/^\d{1,2}$/)
  return normalized ? Number(normalized[0]) : null
}

function stageExpectations(stage) {
  // Staged lab branches should allow the previous lab to pass while keeping
  // the current lab gated until the learner completes it.
  const table = {
    0: { passLab: '00', failLab: '01' },
    1: { passLab: '01', failLab: '02' },
    2: { passLab: '02', failLab: '03' },
    3: { passLab: '03', failLab: '04' },
    4: { passLab: '04', failLab: '05' }
  }

  return table[stage] || null
}

function runCommand(command, args, extraEnv = {}) {
  return spawnSync(command, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...extraEnv
    }
  })
}

function formatResult(result) {
  return [
    `status: ${result.status}`,
    `signal: ${result.signal || 'none'}`,
    result.error ? `error: ${result.error.message}` : 'error: none',
    `stdout:\n${result.stdout}`,
    `stderr:\n${result.stderr}`
  ].join('\n')
}

function ensureBbsLibBuilt() {
  return runCommand('pnpm', ['--filter', 'bbs-lib', 'build'])
}

function runLabCheck(labId) {
  return runCommand('node', ['scripts/lab-check.js', '--start', '--lab', labId], {
    ADMIN_TOKEN: process.env.ADMIN_TOKEN || 'lab-admin',
    IPROOV_PASS_TOKEN: process.env.IPROOV_PASS_TOKEN || 'demo-iproov-token'
  })
}

test('session gating progression is enforced for this stage', { timeout: 240_000 }, (t) => {
  const stage = detectLabStage()
  if (stage == null) {
    t.skip('LAB_STAGE not found in source or env; skipping gating test.')
    return
  }

  const expected = stageExpectations(stage)
  if (!expected) {
    t.skip(`No gating table entry for LAB_STAGE=${stage}.`)
    return
  }

  const buildResult = ensureBbsLibBuilt()
  assert.equal(
    buildResult.status,
    0,
    `Expected bbs-lib build to succeed before lab checks.\n${formatResult(buildResult)}`
  )

  const passResult = runLabCheck(expected.passLab)
  assert.equal(
    passResult.status,
    0,
    `Expected lab ${expected.passLab} to pass for LAB_STAGE=${stage}.\n${formatResult(passResult)}`
  )

  const failResult = runLabCheck(expected.failLab)
  assert.notEqual(
    failResult.status,
    0,
    `Expected lab ${expected.failLab} to remain gated for LAB_STAGE=${stage}.\n${formatResult(failResult)}`
  )
})
