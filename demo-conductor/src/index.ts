import { randomBytes } from 'node:crypto'
import path from 'node:path'
import express, { type Request, type Response } from 'express'
import { OAuth2Client } from 'google-auth-library'
import { type AuthUser, clearAuthCookie, createAuthCookie, readAuthCookie, renderLoginPage } from './auth.js'
import { getSharedActionOwnerKey } from './controller.js'
import { DemoControllerRegistry } from './registry.js'
import { STEP_DEFS, isStepId } from './steps.js'
import { resolvePort } from './utils.js'

const app = express()
const port = resolvePort(process.env.PORT, resolvePort(process.env.DEMO_CONDUCTOR_PORT, 3210))
const repoRoot = path.resolve(process.cwd(), '..')
const publicDir = path.resolve(process.cwd(), 'public')
const brandDir = path.resolve(process.cwd(), '..', 'assets')
const authSecret = process.env.DEMO_CONDUCTOR_AUTH_SECRET || process.env.SESSION_SECRET || randomBytes(32).toString('hex')
const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null
const authEnabled = Boolean(googleClient)
const baseUrl = String(process.env.DEMO_CONDUCTOR_BASE_URL || `http://localhost:${port}`).trim()
const useSecureCookies = baseUrl.startsWith('https://')
const controllers = new DemoControllerRegistry(repoRoot, port)

app.set('trust proxy', 1)
app.use(express.json({ limit: '2mb' }))
app.use('/brand', express.static(brandDir, { index: false }))
app.use(express.static(publicDir, { index: false }))

app.get('/', (req, res) => {
  if (authEnabled && !resolveUser(req)) {
    return res.type('html').send(renderLoginPage({ googleClientId }))
  }
  return res.sendFile(path.join(publicDir, 'index.html'))
})

app.get('/login', (req, res) => {
  if (!authEnabled) return res.redirect('/')
  if (resolveUser(req)) return res.redirect('/')
  return res.type('html').send(renderLoginPage({ googleClientId }))
})

app.post('/auth/google', async (req, res) => {
  if (!authEnabled || !googleClient) {
    return res.status(503).json({ ok: false, error: 'google_auth_disabled' })
  }

  const credential = String(req.body?.credential || '')
  if (!credential) {
    return res.status(400).json({ ok: false, error: 'missing_google_credential' })
  }

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId
    })
    const payload = ticket.getPayload()
    if (!payload?.sub) {
      return res.status(401).json({ ok: false, error: 'invalid_google_identity' })
    }

    const user: AuthUser = {
      id: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      picture: payload.picture || null,
      mode: 'google'
    }

    res.setHeader('set-cookie', createAuthCookie(user, authSecret, useSecureCookies))
    return res.json({ ok: true, user })
  } catch (error: any) {
    console.error('[demo-conductor] google auth failed', error)
    return res.status(401).json({ ok: false, error: error?.message || 'google_auth_failed' })
  }
})

app.post('/auth/logout', (_req, res) => {
  res.setHeader('set-cookie', clearAuthCookie(useSecureCookies))
  res.json({ ok: true })
})

app.get('/api/me', (req, res) => {
  const user = resolveUser(req)
  if (!user) return res.status(401).json({ ok: false, error: 'auth_required' })
  res.json({ ok: true, user })
})

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

app.get('/api/state', async (req, res) => {
  const controller = await requireController(req, res)
  if (!controller) return

  res.json({
    steps: STEP_DEFS,
    state: controller.getState()
  })
})

app.post('/api/reset', async (req, res) => {
  const controller = await requireController(req, res)
  if (!controller) return

  try {
    await controller.reset({ force: req.body?.force === true })
    res.json({ ok: true, state: controller.getState() })
  } catch (error: any) {
    res.status(400).json({ ok: false, error: error?.message || 'reset_failed' })
  }
})

app.post('/api/iproov/claim', async (req, res) => {
  const controller = await requireController(req, res)
  if (!controller) return

  try {
    await controller.startIproovCeremony()
    res.json({ ok: true, state: controller.getState() })
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'iproov_claim_failed', state: controller.getState() })
  }
})

app.post('/api/iproov/validate', async (req, res) => {
  const controller = await requireController(req, res)
  if (!controller) return

  try {
    await controller.validateIproovCeremony()
    res.json({ ok: true, state: controller.getState() })
  } catch (error: any) {
    res.status(500).json({ ok: false, error: error?.message || 'iproov_validate_failed', state: controller.getState() })
  }
})

app.post('/api/steps/:stepId', async (req, res) => {
  const controller = await requireController(req, res)
  if (!controller) return

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
  const controller = await requireRelayController(req, res)
  if (!controller) return

  try {
    await controller.handleRelay(req, res)
  } catch (error: any) {
    res.status(502).json({ error: error?.message || 'relay_failed' })
  }
})

app.listen(port, () => {
  console.log(`[demo-conductor] listening on http://localhost:${port}`)
})

async function requireController(req: Request, res: Response) {
  const user = resolveUser(req)
  if (!user) {
    res.status(401).json({ ok: false, error: 'auth_required' })
    return null
  }
  return controllers.forUser(user.id)
}

async function requireRelayController(req: Request, res: Response) {
  const user = resolveUser(req)
  if (user) {
    return controllers.forUser(user.id)
  }

  if (isLoopbackRequest(req)) {
    const ownerKey = getSharedActionOwnerKey()
    if (!ownerKey) {
      res.status(409).json({ ok: false, error: 'no_active_demo_action' })
      return null
    }
    return controllers.forUser(ownerKey)
  }

  res.status(401).json({ ok: false, error: 'auth_required' })
  return null
}

function resolveUser(req: Request): AuthUser | null {
  if (!authEnabled) {
    return {
      id: 'local-demo',
      email: null,
      name: 'Local demo',
      picture: null,
      mode: 'open'
    }
  }
  return readAuthCookie(req.headers.cookie, authSecret)
}

function isLoopbackRequest(req: Request) {
  const address = String(req.socket.remoteAddress || '')
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1'
}

async function shutdown(signal: string) {
  console.log(`[demo-conductor] received ${signal}; stopping child processes`)
  await controllers.shutdown()
  process.exit(0)
}

process.on('SIGINT', () => {
  void shutdown('SIGINT')
})

process.on('SIGTERM', () => {
  void shutdown('SIGTERM')
})
