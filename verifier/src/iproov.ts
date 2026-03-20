export type IProovSessionRecord = {
  session: string
  passed: boolean
  mode: 'demo' | 'real'
  validatedAt: string | null
  reason: string | null
}

type FetchLike = typeof fetch

export async function fetchIProovSession(sessionBaseUrl: string, session: string, fetchImpl: FetchLike = fetch): Promise<IProovSessionRecord> {
  const response = await fetchImpl(`${sessionBaseUrl}/iproov/session/${encodeURIComponent(session)}`)
  const data = await parseJson(response)

  if (response.status === 404) {
    throw new Error('Unknown iProov session for this BBS+ disclosure')
  }
  if (!response.ok) {
    const upstreamError = typeof data?.error === 'string' ? data.error : `status ${response.status}`
    throw new Error(`Unable to read iProov session state: ${upstreamError}`)
  }

  return {
    session: typeof data?.session === 'string' ? data.session : session,
    passed: Boolean(data?.passed),
    mode: data?.mode === 'real' ? 'real' : 'demo',
    validatedAt: typeof data?.validatedAt === 'string' ? data.validatedAt : null,
    reason: typeof data?.reason === 'string' ? data.reason : null
  }
}

export async function assertPassedIProovSession(sessionBaseUrl: string, session: string, fetchImpl: FetchLike = fetch) {
  const record = await fetchIProovSession(sessionBaseUrl, session, fetchImpl)
  if (!record.passed) {
    if (record.reason) {
      throw new Error(`iProov did not pass: ${record.reason}`)
    }
    throw new Error('Complete the iProov ceremony before verifying the BBS+ disclosure')
  }
  return record
}

async function parseJson(response: Response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}
