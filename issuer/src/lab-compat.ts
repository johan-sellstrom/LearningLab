export type CredentialIssuanceIProovDecision =
  | { allowed: true }
  | { allowed: false; reason: 'requires_liveness' }

export function normalizeLabId(raw: string | null | undefined) {
  const value = String(raw || '').trim()
  return /^\d{2}$/.test(value) ? value : null
}

export function shouldRequireIProovForCredentialIssuance(raw: string | null | undefined) {
  return normalizeLabId(raw) === '04'
}

export function evaluateCredentialIssuanceIProovGate(input: {
  labId?: string | null
  providedSession?: boolean
  passedSession?: boolean | null
}): CredentialIssuanceIProovDecision {
  const providedSession = Boolean(input.providedSession)
  const passedSession = input.passedSession === true

  if (!providedSession) {
    return shouldRequireIProovForCredentialIssuance(input.labId) ? { allowed: false, reason: 'requires_liveness' } : { allowed: true }
  }

  return passedSession ? { allowed: true } : { allowed: false, reason: 'requires_liveness' }
}
