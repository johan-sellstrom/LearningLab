type EnvSource = Record<string, string | undefined>

type RequestLike = typeof fetch

export type IProovConfig = {
  apiBaseUrl: string
  ceremonyBaseUrl: string
  apiKey: string | null
  secret: string | null
  resource: string
  client: string
  assuranceType: string
  passToken: string
  sdkScriptUrl: string
  realCeremonyEnabled: boolean
}

export type IProovValidationResult = {
  passed: boolean
  token: string
  type?: string
  reason?: string
  riskProfile?: string
  assuranceType?: string
  signals?: Record<string, unknown>
  frameAvailable?: boolean
}

const DEFAULT_API_BASE_URL = 'https://eu.rp.iproov.me/api/v2'
const DEFAULT_SDK_SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/@iproov/web'

export function resolveIProovConfig(env: EnvSource): IProovConfig {
  const apiBaseUrl = normalizeIProovApiBaseUrl(env.IPROOV_BASE_URL)
  const ceremonyBaseUrl = normalizeIProovCeremonyBaseUrl(env.IPROOV_BASE_URL)
  const apiKey = clean(env.IPROOV_API_KEY)
  const secret = clean(env.IPROOV_SECRET) || clean(env.IPROOV_MANAGEMENT_KEY)
  const resource = clean(env.IPROOV_RESOURCE) || clean(env.ISSUER_BASE_URL) || 'learninglab-demo-conductor'
  const client = clean(env.IPROOV_CLIENT) || 'web'
  const assuranceType = clean(env.IPROOV_ASSURANCE_TYPE) || 'genuine_presence'
  const passToken = clean(env.IPROOV_PASS_TOKEN) || 'demo-iproov-token'
  const sdkScriptUrl = clean(env.IPROOV_SDK_SCRIPT_URL) || DEFAULT_SDK_SCRIPT_URL

  return {
    apiBaseUrl,
    ceremonyBaseUrl,
    apiKey,
    secret,
    resource,
    client,
    assuranceType,
    passToken,
    sdkScriptUrl,
    realCeremonyEnabled: Boolean(apiKey && secret)
  }
}

export function normalizeIProovApiBaseUrl(raw: string | undefined) {
  const value = clean(raw) || DEFAULT_API_BASE_URL
  const trimmed = value.replace(/\/+$/, '')
  return trimmed.endsWith('/api/v2') ? trimmed : `${trimmed}/api/v2`
}

export function normalizeIProovCeremonyBaseUrl(raw: string | undefined) {
  const apiBaseUrl = normalizeIProovApiBaseUrl(raw)
  return apiBaseUrl.replace(/\/api\/v2$/, '')
}

export async function requestVerifyToken(
  config: IProovConfig,
  { userId }: { userId: string },
  request: RequestLike = fetch
) {
  ensureRealCeremonyEnabled(config)

  const response = await request(`${config.apiBaseUrl}/claim/verify/token`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      assurance_type: config.assuranceType,
      api_key: config.apiKey,
      secret: config.secret,
      resource: config.resource,
      client: config.client,
      user_id: userId
    })
  })

  const data = await parseJsonResponse(response)
  if (!response.ok) {
    throw new Error(readIProovError(data) || `iProov verify token request failed with ${response.status}`)
  }

  const token = typeof data?.token === 'string' ? data.token : ''
  if (!token) {
    throw new Error('iProov verify token response did not include a token')
  }

  return {
    token,
    raw: data
  }
}

export async function validateVerifyToken(
  config: IProovConfig,
  {
    userId,
    token,
    ip = '127.0.0.1'
  }: { userId: string; token: string; ip?: string },
  request: RequestLike = fetch
): Promise<IProovValidationResult> {
  ensureRealCeremonyEnabled(config)

  const response = await request(`${config.apiBaseUrl}/claim/verify/validate`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      api_key: config.apiKey,
      secret: config.secret,
      user_id: userId,
      token,
      ip,
      client: config.resource,
      risk_profile: ''
    })
  })

  const data = await parseJsonResponse(response)
  if (!response.ok) {
    throw new Error(readIProovError(data) || `iProov validation failed with ${response.status}`)
  }
  if (typeof data?.passed !== 'boolean') {
    throw new Error('iProov validation response did not include a passed flag')
  }

  return {
    passed: data.passed,
    token: typeof data.token === 'string' ? data.token : token,
    type: typeof data.type === 'string' ? data.type : undefined,
    reason: typeof data.reason === 'string' ? data.reason : undefined,
    riskProfile: typeof data.risk_profile === 'string' ? data.risk_profile : undefined,
    assuranceType: typeof data.assurance_type === 'string' ? data.assurance_type : undefined,
    signals: isRecord(data.signals) ? data.signals : undefined,
    frameAvailable: typeof data.frame_available === 'boolean' ? data.frame_available : undefined
  }
}

function ensureRealCeremonyEnabled(config: IProovConfig) {
  if (config.realCeremonyEnabled) return
  throw new Error('Real iProov ceremony is not configured')
}

function clean(value: string | undefined | null) {
  const trimmed = String(value || '').trim()
  if (!trimmed || isPlaceholderValue(trimmed)) return null
  return trimmed
}

function isPlaceholderValue(value: string) {
  return /^replace_with_/i.test(value) || /^<.+>$/.test(value)
}

async function parseJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text) as Record<string, any>
  } catch {
    return { raw: text }
  }
}

function readIProovError(data: Record<string, any> | null) {
  if (!data) return null
  if (typeof data.error_description === 'string' && data.error_description) return data.error_description
  if (typeof data.message === 'string' && data.message) return data.message
  if (typeof data.error === 'string' && data.error) return data.error
  return null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
