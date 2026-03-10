import path from 'node:path'
import express from 'express'
import { DemoController } from './controller.js'
import { STEP_DEFS, isStepId } from './steps.js'

const app = express()
const port = Number(process.env.DEMO_CONDUCTOR_PORT || 3210)
const repoRoot = path.resolve(process.cwd(), '..')
const publicDir = path.resolve(process.cwd(), 'public')
const controller = new DemoController({ repoRoot, port })

await controller.init()

app.use(express.json({ limit: '2mb' }))
app.use(express.static(publicDir))

app.get('/api/state', (_req, res) => {
  res.json({
    steps: STEP_DEFS,
    state: controller.getState()
  })
})

app.post('/api/reset', async (req, res) => {
  try {
    await controller.reset({ force: req.body?.force === true })
    res.json({ ok: true, state: controller.getState() })
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || 'reset_failed' })
  }
})

app.post('/api/steps/:stepId', async (req, res) => {
  const { stepId } = req.params
  if (!isStepId(stepId)) {
    return res.status(404).json({ ok: false, error: 'unknown_step' })
  }

  try {
    await controller.runStep(stepId)
    return res.json({ ok: true, state: controller.getState() })
  } catch (error: any) {
    return res.status(500).json({ ok: false, error: error?.message || 'step_failed', state: controller.getState() })
  }
})

app.get('/relay', async (req, res) => {
  try {
    await controller.handleRelay(req, res)
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'relay_failed' })
  }
})

app.listen(port, () => {
  console.log(`[demo-conductor] listening on http://localhost:${port}`)
})

async function shutdown(signal: string) {
  console.log(`[demo-conductor] received ${signal}; stopping child processes`)
  await controller.shutdown()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
