import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { DemoController } from '../src/controller.ts'

test('soft reset rejects while a step is running', async () => {
  const repoRoot = await createTempRepoRoot()
  const controller = new DemoController({ repoRoot, port: 3210, ownerKey: 'user-1' })
  controller.getState().busy = true

  await assert.rejects(controller.reset(), /A step is currently running/)
})

test('force reset clears booth state and rewrites the status list', async () => {
  const repoRoot = await createTempRepoRoot()
  const controller = new DemoController({ repoRoot, port: 3210, ownerKey: 'user-1' })
  const state = controller.getState()

  state.busy = true
  state.currentStepId = 'issue-sd-jwt'
  state.lastError = 'stuck'
  state.relayEnabled = true
  state.steps['start-issuer'] = 'completed'
  state.steps['issue-sd-jwt'] = 'failed'
  state.evidence = [
    {
      id: 1,
      createdAt: new Date().toISOString(),
      stepId: 'system',
      kind: 'note',
      title: 'Old evidence'
    }
  ]
  state.relayEvents = [
    {
      id: 2,
      createdAt: new Date().toISOString(),
      target: 'http://localhost:3002/verify',
      status: 200
    }
  ]
  state.snapshots = {
    issued: { credentialId: 'cred-1' },
    presentation: { verified: true }
  }
  state.artifacts = {
    sdJwt: {
      credentialId: 'cred-1',
      credential: 'token',
      verify: { ok: true }
    },
    bbs: null
  }

  await controller.reset({ force: true })

  assert.equal(state.busy, false)
  assert.equal(state.currentStepId, null)
  assert.equal(state.lastError, null)
  assert.equal(state.relayEnabled, false)
  assert.deepEqual(Object.values(state.steps), Array(6).fill('pending'))
  assert.equal(state.evidence[0]?.title, 'Hard reset complete')
  assert.equal(state.relayEvents.length, 0)
  assert.equal(state.snapshots.issued, null)
  assert.equal(state.snapshots.presentation, null)
  assert.equal(state.artifacts.sdJwt, null)

  const statusList = JSON.parse(await fs.readFile(path.join(repoRoot, 'status-list', 'data', '1.json'), 'utf8'))
  const expected = Buffer.alloc(Math.ceil(8192 / 8)).toString('base64')
  assert.equal(statusList.encodedList, expected)
})

async function createTempRepoRoot() {
  const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'demo-conductor-controller-'))
  await fs.mkdir(path.join(repoRoot, 'status-list', 'data'), { recursive: true })
  await fs.writeFile(
    path.join(repoRoot, 'status-list', 'data', '1.json'),
    JSON.stringify({
      statusPurpose: 'revocation',
      bitstringLength: 8192,
      encodedList: Buffer.from([255]).toString('base64')
    })
  )
  return repoRoot
}
