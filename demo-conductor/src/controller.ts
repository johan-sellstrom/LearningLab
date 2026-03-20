import { spawn, spawnSync, type ChildProcessByStdio } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import type { Readable } from 'node:stream'
import type { Request, Response } from 'express'
import QRCode from 'qrcode'
import { STEP_DEFS, type StepId } from './steps.js'
import { createAbortError, createUnsignedProofJwt, isAllowedRelayTarget, resolveRepoUrl, throwIfAborted, waitFor } from './utils.js'

type ServiceName = 'issuer' | 'verifier'
type ServiceMode = 'dev' | 'start'
type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error'
type StepStatus = 'pending' | 'running' | 'completed' | 'failed'
type EvidenceKind = 'note' | 'process' | 'http' | 'relay'
type IProovMode = 'demo' | 'real'
type IProovStatus = 'idle' | 'pending' | 'passed' | 'failed'

type LogEntry = {
  id: number
  createdAt: string
  stream: 'stdout' | 'stderr' | 'system'
  message: string
}

type EvidenceEntry = {
  id: number
  createdAt: string
  stepId: StepId | 'system'
  kind: EvidenceKind
  title: string
  detail?: string
  request?: unknown
  response?: unknown
}

type RelayEntry = {
  id: number
  createdAt: string
  target: string
  status: number
}

type ServiceState = {
  status: ServiceStatus
  pid: number | null
  command: string
  env: Record<string, string>
  startedAt: string | null
  lastExitCode: number | null
  logs: LogEntry[]
}

type SnapshotState = {
  issued: unknown | null
  presentation: unknown | null
}

type SdArtifact = {
  credentialId: string
  credential: string
  verify: unknown
}

type BbsArtifact = {
  iproovSession: string
  credentialId: string
  messages: string[]
  signature: string
  proof: string
  revealedMessages: string[]
  verify: unknown
}

type DemoState = {
  busy: boolean
  currentStepId: StepId | null
  lastError: string | null
  repoUrl: string | null
  qrSvg: string | null
  relayEnabled: boolean
  iproov: {
    realCeremonyEnabled: boolean
    sdkScriptUrl: string | null
    ceremonyBaseUrl: string | null
    session: string | null
    token: string | null
    mode: IProovMode | null
    status: IProovStatus
    note: string | null
    reason: string | null
    validatedAt: string | null
  }
  services: Record<ServiceName, ServiceState>
  steps: Record<StepId, StepStatus>
  evidence: EvidenceEntry[]
  relayEvents: RelayEntry[]
  snapshots: SnapshotState
  artifacts: {
    sdJwt: SdArtifact | null
    bbs: BbsArtifact | null
  }
}

type JsonResponse = {
  ok: boolean
  status: number
  data: unknown
}

type ResetOptions = {
  force?: boolean
}

type RunContext = {
  generation: number
  runKey: number
  signal: AbortSignal
}

type SharedRuntime = {
  relayEnabled: boolean
  processes: Record<ServiceName, ManagedProcess | null>
  services: Record<ServiceName, ServiceState>
}

const MAX_LOGS = 160
const MAX_EVIDENCE = 40
const MAX_RELAY_EVENTS = 40
const ISSUER_BASE_URL = 'http://localhost:3001'
const VERIFIER_BASE_URL = 'http://localhost:3002'
const SERVICE_MODE = parseServiceMode(process.env.DEMO_CONDUCTOR_SERVICE_MODE)
const DEFAULT_IPROOV_SDK_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@iproov/web'

export class DemoController {
  private readonly repoRoot: string
  private readonly port: number
  private readonly ownerKey: string
  private readonly relayUrl: string
  private readonly shared: SharedRuntime
  private readonly stepIds: StepId[]
  private generation = 0
  private activeRunKey: number | null = null
  private currentAbortController: AbortController | null = null
  private nextId = 1
  private readonly state: DemoState

  constructor({ repoRoot, port, ownerKey }: { repoRoot: string; port: number; ownerKey: string }) {
    this.repoRoot = repoRoot
    this.port = port
    this.ownerKey = ownerKey
    this.relayUrl = `http://localhost:${port}/relay`
    this.shared = getSharedRuntime(repoRoot)
    this.stepIds = STEP_DEFS.map((step) => step.id)
    this.state = {
      busy: false,
      currentStepId: null,
      lastError: null,
      repoUrl: null,
      qrSvg: null,
      relayEnabled: this.shared.relayEnabled,
      iproov: this.createIproovState(),
      services: {
        issuer: this.shared.services.issuer,
        verifier: this.shared.services.verifier
      },
      steps: Object.fromEntries(this.stepIds.map((stepId) => [stepId, 'pending'])) as Record<StepId, StepStatus>,
      evidence: [],
      relayEvents: [],
      snapshots: {
        issued: null,
        presentation: null
      },
      artifacts: {
        sdJwt: null,
        bbs: null
      }
    }
  }

  async init() {
    this.state.repoUrl = resolveRepoUrl(process.env.DEMO_CONDUCTOR_REPO_URL, this.readGitRemote())
    if (this.state.repoUrl) {
      this.state.qrSvg = await QRCode.toString(this.state.repoUrl, {
        type: 'svg',
        margin: 1,
        width: 180,
        color: {
          dark: '#111111',
          light: '#f6f2e8'
        }
      })
    }
  }

  getState() {
    this.state.relayEnabled = this.shared.relayEnabled
    this.state.services = this.shared.services
    return this.state
  }

  async reset(options: ResetOptions = {}) {
    const force = options.force === true
    if (this.state.busy && !force) throw new Error('A step is currently running')

    this.invalidateCurrentRun(force ? 'Demo hard reset requested' : 'Demo reset requested')
    if (force) {
      this.claimSharedActionLock()
      try {
        await this.stopService('verifier')
        await this.stopService('issuer')
        await this.resetStatusList()
        this.shared.services.issuer = createSharedServiceState(this.repoRoot, 'issuer')
        this.shared.services.verifier = createSharedServiceState(this.repoRoot, 'verifier')
        this.shared.relayEnabled = false
      } finally {
        this.releaseSharedActionLock()
      }
    }
    this.state.busy = false
    this.state.currentStepId = null
    this.state.lastError = null
    this.state.relayEnabled = this.shared.relayEnabled
    this.state.services = this.shared.services
    this.state.iproov = this.createIproovState()
    this.state.evidence = []
    this.state.relayEvents = []
    this.state.snapshots = { issued: null, presentation: null }
    this.state.artifacts = { sdJwt: null, bbs: null }
    this.state.steps = Object.fromEntries(this.stepIds.map((stepId) => [stepId, 'pending'])) as Record<StepId, StepStatus>
    this.appendEvidence({
      stepId: 'system',
      kind: 'note',
      title: force ? 'Hard reset complete' : 'Session reset',
      detail: force
        ? 'Force-stopped shared local services, cleared artifacts, and zeroed the status list.'
        : 'Cleared your demo state. Shared services and relay mode were left as-is for other signed-in users.'
    })
  }

  async runStep(stepId: StepId) {
    if (this.state.busy) throw new Error('Another step is already running')
    this.claimSharedActionLock()
    const context = this.createRunContext()
    this.state.busy = true
    this.state.currentStepId = stepId
    this.state.lastError = null
    this.state.steps[stepId] = 'running'

    try {
      switch (stepId) {
        case 'start-issuer':
          await this.runStartIssuer(context)
          break
        case 'start-verifier':
          await this.runStartVerifier(context)
          break
        case 'issue-sd-jwt':
          await this.runIssueSdJwt(context)
          break
        case 'issue-bbs':
          await this.runIssueBbs(context)
          break
        case 'enable-relay':
          await this.runEnableRelay(context)
          break
        case 'revoke-credential':
          await this.runRevokeCredential(context)
          break
      }
      this.assertRunActive(context)
      this.state.steps[stepId] = 'completed'
    } catch (error: any) {
      if (this.isRunInvalidated(context)) return
      this.state.steps[stepId] = 'failed'
      this.state.lastError = error?.message || String(error)
      this.appendEvidence({
        stepId,
        kind: 'note',
        title: 'Step failed',
        detail: this.state.lastError || undefined
      })
      throw error
    } finally {
      this.releaseRun(context)
    }
  }

  async startIproovCeremony() {
    if (this.state.busy) throw new Error('Another step is already running')
    if (this.state.services.issuer.status !== 'running' || this.state.services.verifier.status !== 'running') {
      throw new Error('Start the issuer and verifier before running iProov for the BBS+ disclosure')
    }
    this.claimSharedActionLock()
    const context = this.createRunContext()
    this.state.busy = true
    this.state.lastError = null

    try {
      const claim = await this.requestJson(context, 'system', 'Create iProov session', `${ISSUER_BASE_URL}/iproov/claim`)
      this.updateIproovStateFromClaim(claim.data as Record<string, any>)
      return this.state
    } catch (error: any) {
      if (!this.isRunInvalidated(context)) {
        this.state.lastError = error?.message || String(error)
      }
      throw error
    } finally {
      this.releaseRun(context)
    }
  }

  async validateIproovCeremony() {
    if (this.state.busy) throw new Error('Another step is already running')
    if (!this.state.iproov.session) throw new Error('Start an iProov ceremony first')
    this.claimSharedActionLock()
    const context = this.createRunContext()
    this.state.busy = true
    this.state.lastError = null

    try {
      await this.ensureService('issuer', context)
      const validation = await this.requestJson(
        context,
        'system',
        'Validate iProov ceremony',
        `${ISSUER_BASE_URL}/iproov/validate`,
        {
          method: 'POST',
          body: { session: this.state.iproov.session }
        },
        { expectOk: false }
      )

      const data = (validation.data || {}) as Record<string, any>
      this.state.iproov.status = validation.ok && data.passed ? 'passed' : 'failed'
      this.state.iproov.reason = typeof data.reason === 'string'
        ? data.reason
        : typeof data.message === 'string'
          ? data.message
          : validation.ok
            ? null
            : 'iProov validation failed'
      this.state.iproov.validatedAt = typeof data.validatedAt === 'string' ? data.validatedAt : new Date().toISOString()
      this.state.iproov.note = validation.ok && data.passed
        ? 'Live iProov ceremony validated and ready for Issue BBS+.'
        : this.state.iproov.reason

      return this.state
    } catch (error: any) {
      if (!this.isRunInvalidated(context)) {
        this.state.lastError = error?.message || String(error)
        this.state.iproov.status = 'failed'
        this.state.iproov.reason = this.state.lastError
      }
      throw error
    } finally {
      this.releaseRun(context)
    }
  }

  async handleRelay(req: Request, res: Response) {
    const target = String(req.query.target || '')
    const allowedOrigins = [ISSUER_BASE_URL, VERIFIER_BASE_URL]
    if (!isAllowedRelayTarget(target, allowedOrigins)) {
      return res.status(400).json({ error: 'invalid_target' })
    }

    const upstream = await fetch(target)
    const buffer = Buffer.from(await upstream.arrayBuffer())

    this.appendRelayEvent(target, upstream.status)
    this.appendEvidence({
      stepId: 'system',
      kind: 'relay',
      title: 'Relay forwarded request',
      detail: target,
      response: { status: upstream.status }
    })

    res.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) res.setHeader('content-type', contentType)
    return res.send(buffer)
  }

  async shutdown() {
    await this.stopService('verifier')
    await this.stopService('issuer')
  }

  private createServiceState(name: ServiceName): ServiceState {
    return {
      status: 'stopped',
      pid: null,
      command: buildServiceSpec(this.repoRoot, name, SERVICE_MODE).displayCommand,
      env: {},
      startedAt: null,
      lastExitCode: null,
      logs: []
    }
  }

  private createIproovState(): DemoState['iproov'] {
    const realCeremonyEnabled = hasRealIproovConfig()
    return {
      realCeremonyEnabled,
      sdkScriptUrl: process.env.IPROOV_SDK_SCRIPT_URL || DEFAULT_IPROOV_SDK_SCRIPT_URL,
      ceremonyBaseUrl: normalizeIproovCeremonyBaseUrl(process.env.IPROOV_BASE_URL),
      session: null,
      token: null,
      mode: realCeremonyEnabled ? 'real' : 'demo',
      status: 'idle' as IProovStatus,
      note: realCeremonyEnabled
        ? 'Real iProov browser ceremony ready. Complete the iProov step before Issue BBS+.'
        : 'No real iProov credentials configured. The iProov step stays informational and Issue BBS+ uses the simulated callback path.',
      reason: null,
      validatedAt: null
    }
  }

  private appendServiceLog(service: ServiceName, stream: LogEntry['stream'], message: string) {
    const logs = this.shared.services[service].logs
    logs.push({
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      stream,
      message
    })
    if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS)
  }

  private appendEvidence(entry: Omit<EvidenceEntry, 'id' | 'createdAt'>) {
    this.state.evidence.unshift({
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      ...entry
    })
    if (this.state.evidence.length > MAX_EVIDENCE) {
      this.state.evidence.splice(MAX_EVIDENCE)
    }
  }

  private appendRelayEvent(target: string, status: number) {
    this.state.relayEvents.unshift({
      id: this.nextId++,
      createdAt: new Date().toISOString(),
      target,
      status
    })
    if (this.state.relayEvents.length > MAX_RELAY_EVENTS) {
      this.state.relayEvents.splice(MAX_RELAY_EVENTS)
    }
  }

  private async runStartIssuer(context: RunContext) {
    await this.startService('issuer', this.buildIssuerEnv(), context)
    await this.captureSnapshots('start-issuer', context)
    this.assertRunActive(context)
    this.appendEvidence({
      stepId: 'start-issuer',
      kind: 'process',
      title: 'Issuer online',
      detail: 'Metadata and credential endpoints are now available on port 3001.'
    })
  }

  private async runStartVerifier(context: RunContext) {
    await this.startService('verifier', this.buildVerifierEnv({ relayEnabled: this.shared.relayEnabled }), context)
    await this.captureSnapshots('start-verifier', context)
    this.assertRunActive(context)
    this.appendEvidence({
      stepId: 'start-verifier',
      kind: 'process',
      title: 'Verifier online',
      detail: 'Verification and debug endpoints are now available on port 3002.'
    })
  }

  private async runIssueSdJwt(context: RunContext) {
    await this.ensureService('issuer', context)
    await this.ensureService('verifier', context)

    const offer = await this.requestJson(context, 'issue-sd-jwt', 'Request SD-JWT offer', `${ISSUER_BASE_URL}/credential-offers`, {
      method: 'POST',
      body: { credentials: ['AgeCredential'] }
    })
    const offerData = offer.data as Record<string, any>
    this.assertRunActive(context)
    const code = String(offerData.credential_offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code'])

    const token = await this.requestJson(context, 'issue-sd-jwt', 'Exchange pre-authorized code', `${ISSUER_BASE_URL}/token`, {
      method: 'POST',
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code: code
      }
    })
    const tokenData = token.data as Record<string, any>
    this.assertRunActive(context)
    const proofJwt = createUnsignedProofJwt({
      nonce: tokenData.c_nonce,
      aud: `${ISSUER_BASE_URL}/credential`
    })

    const credential = await this.requestJson(context, 'issue-sd-jwt', 'Mint SD-JWT credential', `${ISSUER_BASE_URL}/credential`, {
      method: 'POST',
      headers: { authorization: `Bearer ${String(tokenData.access_token)}` },
      body: {
        format: 'vc+sd-jwt',
        claims: { age_over: 21, residency: 'SE' },
        proof: { proof_type: 'jwt', jwt: proofJwt }
      }
    })
    const credentialData = credential.data as Record<string, any>
    this.assertRunActive(context)

    const verify = await this.requestJson(context, 'issue-sd-jwt', 'Verify SD-JWT credential', `${VERIFIER_BASE_URL}/verify`, {
      method: 'POST',
      body: {
        format: 'vc+sd-jwt',
        credential: credentialData.credential
      }
    })

    this.assertRunActive(context)
    this.state.artifacts.sdJwt = {
      credentialId: String(credentialData.credentialId),
      credential: String(credentialData.credential),
      verify: verify.data
    }
    await this.captureSnapshots('issue-sd-jwt', context)
  }

  private async runIssueBbs(context: RunContext) {
    await this.ensureService('issuer', context)
    await this.ensureService('verifier', context)

    const offer = await this.requestJson(context, 'issue-bbs', 'Request BBS offer', `${ISSUER_BASE_URL}/credential-offers`, {
      method: 'POST',
      body: { credentials: ['AgeCredentialBBS'] }
    })
    const offerData = offer.data as Record<string, any>
    this.assertRunActive(context)
    const code = String(offerData.credential_offer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code'])

    const token = await this.requestJson(context, 'issue-bbs', 'Exchange pre-authorized code', `${ISSUER_BASE_URL}/token`, {
      method: 'POST',
      body: {
        grant_type: 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
        pre_authorized_code: code
      }
    })
    const tokenData = token.data as Record<string, any>
    this.assertRunActive(context)
    const proofJwt = createUnsignedProofJwt({
      nonce: tokenData.c_nonce,
      aud: `${ISSUER_BASE_URL}/credential`
    })

    const credential = await this.requestJson(context, 'issue-bbs', 'Mint BBS credential', `${ISSUER_BASE_URL}/credential`, {
      method: 'POST',
      headers: { authorization: `Bearer ${String(tokenData.access_token)}` },
      body: {
        format: 'di-bbs',
        claims: { age_over: 25, residency: 'SE' },
        proof: { proof_type: 'jwt', jwt: proofJwt }
      }
    })
    const credentialData = credential.data as Record<string, any>
    this.assertRunActive(context)

    const proof = await this.requestJson(context, 'issue-bbs', 'Derive BBS selective-disclosure proof', `${ISSUER_BASE_URL}/bbs/proof`, {
      method: 'POST',
      body: {
        signature: credentialData.signature,
        messages: credentialData.messages,
        reveal: [1],
        nonce: 'bbs-demo-nonce'
      }
    })
    const proofData = proof.data as Record<string, any>
    this.assertRunActive(context)

    const session = await this.resolveIproovSession(context, 'issue-bbs')

    const verify = await this.requestJson(context, 'issue-bbs', 'Verify BBS proof', `${VERIFIER_BASE_URL}/verify`, {
      method: 'POST',
      body: {
        format: 'di-bbs',
        proof: {
          proof: proofData.proof,
          revealedMessages: proofData.revealedMessages,
          nonce: proofData.nonce
        },
        credentialStatus: credentialData.credentialStatus,
        iproov_session: session
      }
    })

    this.assertRunActive(context)
    this.state.artifacts.bbs = {
      iproovSession: session,
      credentialId: String(credentialData.credentialId),
      messages: credentialData.messages as string[],
      signature: String(credentialData.signature),
      proof: String(proofData.proof),
      revealedMessages: proofData.revealedMessages as string[],
      verify: verify.data
    }
    await this.captureSnapshots('issue-bbs', context)
  }

  private async runEnableRelay(context: RunContext) {
    await this.ensureService('issuer', context)
    await this.ensureService('verifier', context)
    if (!this.state.artifacts.sdJwt) throw new Error('Run the SD-JWT step before enabling the relay')

    this.assertRunActive(context)
    this.shared.relayEnabled = true
    this.state.relayEvents = []
    await this.startService('verifier', this.buildVerifierEnv({ relayEnabled: true }), context, { restart: true })

    await this.requestJson(context, 'enable-relay', 'Verify SD-JWT through relay', `${VERIFIER_BASE_URL}/verify`, {
      method: 'POST',
      body: {
        format: 'vc+sd-jwt',
        credential: this.state.artifacts.sdJwt.credential
      }
    })
    await this.captureSnapshots('enable-relay', context)
  }

  private async runRevokeCredential(context: RunContext) {
    await this.ensureService('issuer', context)
    await this.ensureService('verifier', context)
    if (!this.state.artifacts.sdJwt) throw new Error('Run the SD-JWT step before revocation')

    await this.requestJson(context, 'revoke-credential', 'Revoke issued credential', `${ISSUER_BASE_URL}/revoke/${this.state.artifacts.sdJwt.credentialId}`, {
      method: 'POST',
      headers: { 'x-admin-token': 'change_me' }
    })
    this.assertRunActive(context)

    const verify = await this.requestJson(
      context,
      'revoke-credential',
      'Re-verify revoked credential',
      `${VERIFIER_BASE_URL}/verify`,
      {
        method: 'POST',
        body: {
          format: 'vc+sd-jwt',
          credential: this.state.artifacts.sdJwt.credential
        }
      },
      { expectOk: false }
    )

    this.assertRunActive(context)
    if (verify.ok) {
      throw new Error('Revoked credential still verified successfully')
    }

    await this.captureSnapshots('revoke-credential', context)
  }

  private async ensureService(name: ServiceName, context: RunContext) {
    if (this.shared.services[name].status === 'running') return
    if (name === 'issuer') {
      await this.startService('issuer', this.buildIssuerEnv(), context)
    } else {
      await this.startService('verifier', this.buildVerifierEnv({ relayEnabled: this.shared.relayEnabled }), context)
    }
  }

  private async startService(name: ServiceName, env: Record<string, string>, context: RunContext, options: { restart?: boolean } = {}) {
    const current = this.shared.processes[name]
    const currentEnv = JSON.stringify(this.shared.services[name].env)
    const nextEnv = JSON.stringify(env)
    if (current && this.shared.services[name].status === 'running' && currentEnv === nextEnv && !options.restart) {
      return
    }

    if (current) {
      await this.stopService(name)
    }

    const spec = buildServiceSpec(this.repoRoot, name, SERVICE_MODE)
    const child = spawn(spec.command, spec.args, {
      cwd: spec.cwd,
      env: {
        ...process.env,
        ...env,
        FORCE_COLOR: '0'
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    this.shared.processes[name] = child
    this.shared.services[name].status = 'starting'
    this.shared.services[name].pid = child.pid ?? null
    this.shared.services[name].env = env
    this.shared.services[name].startedAt = new Date().toISOString()
    this.shared.services[name].lastExitCode = null
    this.appendEvidence({
      stepId: 'system',
      kind: 'process',
      title: `Started ${name}`,
      detail: `${this.shared.services[name].command} (${name === 'verifier' && this.shared.relayEnabled ? 'relay on' : 'relay off'})`
    })

    this.attachProcessLogs(name, child)

    child.on('exit', (code) => {
      this.shared.processes[name] = null
      this.shared.services[name].status = code === 0 ? 'stopped' : 'error'
      this.shared.services[name].pid = null
      this.shared.services[name].lastExitCode = code
      this.appendServiceLog(name, 'system', `Process exited with code ${code ?? 'unknown'}`)
    })

    await this.waitForServiceHealth(name, context)
    this.assertRunActive(context)
    this.shared.services[name].status = 'running'
  }

  private attachProcessLogs(name: ServiceName, child: ManagedProcess) {
    for (const [streamName, stream] of [
      ['stdout', child.stdout],
      ['stderr', child.stderr]
    ] as const) {
      let buffer = ''
      stream.setEncoding('utf8')
      stream.on('data', (chunk: string) => {
        buffer += chunk
        const parts = buffer.split(/\r?\n/)
        buffer = parts.pop() || ''
        for (const line of parts) {
          const trimmed = line.trim()
          if (trimmed) this.appendServiceLog(name, streamName, trimmed)
        }
      })
      stream.on('end', () => {
        const trimmed = buffer.trim()
        if (trimmed) this.appendServiceLog(name, streamName, trimmed)
      })
    }
  }

  private async stopService(name: ServiceName) {
    const child = this.shared.processes[name]
    if (!child) {
      this.shared.services[name].status = 'stopped'
      this.shared.services[name].pid = null
      return
    }

    this.shared.services[name].status = 'stopping'
    child.kill('SIGTERM')
    try {
      await waitFor(() => !this.shared.processes[name], {
        timeoutMs: 4_000,
        intervalMs: 100,
        label: `${name} to stop`
      })
    } catch {
      child.kill('SIGKILL')
      await waitFor(() => !this.shared.processes[name], {
        timeoutMs: 2_000,
        intervalMs: 100,
        label: `${name} to force-stop`
      })
    }
  }

  private async waitForServiceHealth(name: ServiceName, context: RunContext) {
    const url = name === 'issuer'
      ? `${ISSUER_BASE_URL}/.well-known/openid-credential-issuer`
      : `${VERIFIER_BASE_URL}/`

    await waitFor(async () => {
      try {
        const response = await fetch(url, { signal: context.signal })
        if (!response.ok) return false
        return true
      } catch {
        return false
      }
    }, {
      timeoutMs: 15_000,
      intervalMs: 250,
      label: `${name} health`,
      signal: context.signal
    })
  }

  private async captureSnapshots(stepId: StepId, context: RunContext) {
    const issued = this.shared.services.issuer.status === 'running'
      ? await this.requestJson(context, stepId, 'Fetch issuer debug state', `${ISSUER_BASE_URL}/debug/issued`, undefined, { expectOk: false })
      : { data: null }
    const presentation = this.shared.services.verifier.status === 'running'
      ? await this.requestJson(context, stepId, 'Fetch verifier debug state', `${VERIFIER_BASE_URL}/debug/credential`, undefined, { expectOk: false })
      : { data: null }
    this.assertRunActive(context)
    this.state.snapshots = {
      issued: issued.data,
      presentation: presentation.data
    }
  }

  private async requestJson(
    context: RunContext,
    stepId: StepId | 'system',
    title: string,
    url: string,
    init?: {
      method?: 'GET' | 'POST'
      headers?: Record<string, string>
      body?: unknown
    },
    options: { expectOk?: boolean } = {}
  ): Promise<JsonResponse> {
    const method = init?.method || 'GET'
    const headers: Record<string, string> = {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(init?.headers || {})
    }

    const response = await fetch(url, {
      method,
      headers,
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: context.signal
    })
    const text = await response.text()
    const data = this.parseJson(text)
    this.assertRunActive(context)

    this.appendEvidence({
      stepId,
      kind: 'http',
      title,
      request: {
        method,
        url,
        headers,
        body: init?.body
      },
      response: {
        status: response.status,
        ok: response.ok,
        data
      }
    })

    if (options.expectOk !== false && !response.ok) {
      throw new Error(`${title} failed with ${response.status}`)
    }

    return {
      ok: response.ok,
      status: response.status,
      data
    }
  }

  private parseJson(text: string) {
    if (!text) return null
    try {
      return JSON.parse(text)
    } catch {
      return text
    }
  }

  private buildIssuerEnv() {
    return {
      ISSUER_PORT: '3001',
      ISSUER_BASE_URL: ISSUER_BASE_URL,
      STATUS_LIST_ID: '1',
      STATUS_LIST_SIZE_BITS: '8192',
      USE_DPOP: 'false',
      DEMO_MODE: 'true',
      ADMIN_TOKEN: 'change_me',
      USE_OHTTP: 'false',
      IPROOV_PASS_TOKEN: 'demo-iproov-token',
      ...(process.env.IPROOV_BASE_URL ? { IPROOV_BASE_URL: process.env.IPROOV_BASE_URL } : {}),
      ...(process.env.IPROOV_API_KEY ? { IPROOV_API_KEY: process.env.IPROOV_API_KEY } : {}),
      ...(process.env.IPROOV_SECRET ? { IPROOV_SECRET: process.env.IPROOV_SECRET } : {}),
      ...(process.env.IPROOV_MANAGEMENT_KEY ? { IPROOV_MANAGEMENT_KEY: process.env.IPROOV_MANAGEMENT_KEY } : {}),
      ...(process.env.IPROOV_RESOURCE ? { IPROOV_RESOURCE: process.env.IPROOV_RESOURCE } : {}),
      ...(process.env.IPROOV_CLIENT ? { IPROOV_CLIENT: process.env.IPROOV_CLIENT } : {}),
      ...(process.env.IPROOV_ASSURANCE_TYPE ? { IPROOV_ASSURANCE_TYPE: process.env.IPROOV_ASSURANCE_TYPE } : {}),
      ...(process.env.IPROOV_SDK_SCRIPT_URL ? { IPROOV_SDK_SCRIPT_URL: process.env.IPROOV_SDK_SCRIPT_URL } : {})
    }
  }

  private buildVerifierEnv({ relayEnabled }: { relayEnabled: boolean }) {
    return {
      VERIFIER_PORT: '3002',
      VERIFIER_BASE_URL: VERIFIER_BASE_URL,
      ISSUER_BASE_URL: ISSUER_BASE_URL,
      ISSUER_JWKS_URL: `${ISSUER_BASE_URL}/.well-known/jwks.json`,
      BBS_KEY_URL: `${ISSUER_BASE_URL}/.well-known/bbs-public-key`,
      STATUS_LIST_ID: '1',
      DEMO_MODE: 'true',
      USE_OHTTP: relayEnabled ? 'true' : 'false',
      OHTTP_RELAY_URL: relayEnabled ? this.relayUrl : 'http://localhost:8787',
      USE_DPOP: 'false',
      USE_WEBAUTHN: 'false'
    }
  }

  private async resetStatusList() {
    const filePath = path.join(this.repoRoot, 'status-list', 'data', '1.json')
    const bytesLen = Math.ceil(8192 / 8)
    const payload = {
      statusPurpose: 'revocation',
      bitstringLength: 8192,
      encodedList: Buffer.alloc(bytesLen).toString('base64')
    }
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2))
  }

  private readGitRemote() {
    const remote = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
      cwd: this.repoRoot,
      encoding: 'utf8'
    })
    return remote.stdout || null
  }

  private createRunContext(): RunContext {
    const abortController = new AbortController()
    const runKey = this.nextId++
    this.currentAbortController = abortController
    this.activeRunKey = runKey
    return {
      generation: this.generation,
      runKey,
      signal: abortController.signal
    }
  }

  private invalidateCurrentRun(reason: string) {
    this.generation += 1
    this.currentAbortController?.abort(createAbortError(reason))
    this.currentAbortController = null
    this.activeRunKey = null
  }

  private releaseRun(context: RunContext) {
    if (this.activeRunKey !== context.runKey) return
    this.currentAbortController = null
    this.activeRunKey = null
    this.state.busy = false
    this.state.currentStepId = null
    this.releaseSharedActionLock()
  }

  private isRunInvalidated(context: RunContext) {
    if (context.generation !== this.generation) return true
    if (this.activeRunKey !== context.runKey) return true
    try {
      throwIfAborted(context.signal)
      return false
    } catch (error: any) {
      return error?.name === 'AbortError'
    }
  }

  private assertRunActive(context: RunContext) {
    if (!this.isRunInvalidated(context)) return
    throwIfAborted(context.signal)
    throw createAbortError('Demo run invalidated')
  }

  private async resolveIproovSession(context: RunContext, stepId: StepId) {
    if (this.state.iproov.realCeremonyEnabled) {
      if (!this.state.iproov.session || this.state.iproov.status !== 'passed') {
        throw new Error('Complete the iProov browser ceremony before the BBS+ disclosure is verified')
      }
      this.appendEvidence({
        stepId,
        kind: 'note',
        title: 'Using validated iProov session',
        detail: `Session ${this.state.iproov.session} belongs to the signed-in user and is ready for BBS+ disclosure verification.`
      })
      return this.state.iproov.session
    }

    const claim = await this.requestJson(context, stepId, 'Create iProov session', `${ISSUER_BASE_URL}/iproov/claim`)
    const claimData = claim.data as Record<string, any>
    this.assertRunActive(context)
    const session = String(claimData.session)

    await this.requestJson(context, stepId, 'Mark iProov session passed', `${ISSUER_BASE_URL}/iproov/webhook`, {
      method: 'POST',
      body: { session, signals: { matching: { passed: true } } }
    })
    this.assertRunActive(context)

    this.state.iproov = {
      ...this.state.iproov,
      session,
      token: typeof claimData.token === 'string' ? claimData.token : null,
      mode: 'demo',
      status: 'passed',
      reason: null,
      validatedAt: new Date().toISOString(),
      note: 'Simulated iProov callback passed for the BBS+ disclosure demo.'
    }

    return session
  }

  private updateIproovStateFromClaim(data: Record<string, any>) {
    const mode = data.mode === 'real' ? 'real' : 'demo'
    this.state.iproov = {
      ...this.state.iproov,
      session: typeof data.session === 'string' ? data.session : null,
      token: typeof data.token === 'string' ? data.token : null,
      mode,
      status: 'pending',
      note: typeof data.note === 'string'
        ? data.note
        : mode === 'real'
          ? 'Launch the real iProov ceremony in the browser, then return to Issue BBS+.'
          : 'Simulated iProov mode is active. Issue BBS+ will mark the callback passed.',
      reason: null,
      validatedAt: null,
      ceremonyBaseUrl: typeof data.baseUrl === 'string' ? data.baseUrl : this.state.iproov.ceremonyBaseUrl,
      sdkScriptUrl: typeof data.sdkScriptUrl === 'string' ? data.sdkScriptUrl : this.state.iproov.sdkScriptUrl,
      realCeremonyEnabled: mode === 'real'
    }
  }

  private claimSharedActionLock() {
    if (sharedActionOwnerKey && sharedActionOwnerKey !== this.ownerKey) {
      throw new Error('Another signed-in user is currently running a demo action')
    }
    sharedActionOwnerKey = this.ownerKey
  }

  private releaseSharedActionLock() {
    if (sharedActionOwnerKey === this.ownerKey) {
      sharedActionOwnerKey = null
    }
  }
}

type ManagedProcess = ChildProcessByStdio<null, Readable, Readable>

let sharedRuntime: SharedRuntime | null = null
let sharedActionOwnerKey: string | null = null

export function getSharedActionOwnerKey() {
  return sharedActionOwnerKey
}

function buildServiceCommand(name: ServiceName, mode: ServiceMode) {
  return `pnpm --filter ${name} ${mode}`
}

function parseServiceMode(value: string | undefined): ServiceMode {
  return value === 'start' ? 'start' : 'dev'
}

function buildServiceSpec(repoRoot: string, name: ServiceName, mode: ServiceMode) {
  if (mode === 'start') {
    return {
      command: 'node',
      args: ['dist/index.js'],
      cwd: path.join(repoRoot, name),
      displayCommand: `node ${name}/dist/index.js`
    }
  }

  return {
    command: 'pnpm',
    args: ['--filter', name, 'dev'],
    cwd: repoRoot,
    displayCommand: buildServiceCommand(name, mode)
  }
}

function hasRealIproovConfig() {
  return Boolean(process.env.IPROOV_API_KEY && (process.env.IPROOV_SECRET || process.env.IPROOV_MANAGEMENT_KEY))
}

function normalizeIproovCeremonyBaseUrl(raw: string | undefined) {
  const base = String(raw || '').trim() || 'https://eu.rp.iproov.me'
  return base.replace(/\/api\/v2\/?$/, '').replace(/\/+$/, '')
}

function getSharedRuntime(repoRoot: string): SharedRuntime {
  if (sharedRuntime) return sharedRuntime
  sharedRuntime = {
    relayEnabled: false,
    processes: {
      issuer: null,
      verifier: null
    },
    services: {
      issuer: createSharedServiceState(repoRoot, 'issuer'),
      verifier: createSharedServiceState(repoRoot, 'verifier')
    }
  }
  return sharedRuntime
}

function createSharedServiceState(repoRoot: string, name: ServiceName): ServiceState {
  return {
    status: 'stopped',
    pid: null,
    command: buildServiceSpec(repoRoot, name, SERVICE_MODE).displayCommand,
    env: {},
    startedAt: null,
    lastExitCode: null,
    logs: []
  }
}
