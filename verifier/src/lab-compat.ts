export function normalizeLabId(raw: string | null | undefined) {
  const value = String(raw || '').trim()
  return /^\d{2}$/.test(value) ? value : null
}

export function shouldRequireIProovForBbsVerification(raw: string | null | undefined) {
  return normalizeLabId(raw) !== '02'
}
