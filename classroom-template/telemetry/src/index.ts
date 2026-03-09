// DivviUp (DAP) telemetry stub — aggregate counters only
// In production, submit encrypted reports to Leader/Helper. For demo purposes we
// log counters locally to avoid any per-user tracking.

export type CounterName =
  | 'presentations_succeeded'
  | 'presentations_failed'
  | 'issuance_succeeded'
  | 'issuance_failed'
  | 'iproov_retry_count'

const counters: Record<CounterName, number> = {
  presentations_succeeded: 0,
  presentations_failed: 0,
  issuance_succeeded: 0,
  issuance_failed: 0,
  iproov_retry_count: 0
}

export function incrementCounter(name: CounterName, by = 1) {
  counters[name] = (counters[name] || 0) + by
  // Placeholder for DivviUp submission batching
  // TODO: encrypt and send to DivviUp endpoints periodically
  console.log('[telemetry]', name, '=>', counters[name])
}

export function snapshot() {
  return { ...counters }
}
