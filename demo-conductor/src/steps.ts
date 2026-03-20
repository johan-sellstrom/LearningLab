export const STEP_DEFS = [
  {
    id: 'start-issuer',
    title: 'Start Issuer',
    summary: 'Boot the local OIDC4VCI issuer and publish metadata.'
  },
  {
    id: 'start-verifier',
    title: 'Start Verifier',
    summary: 'Bring up the relying party and make verification available.'
  },
  {
    id: 'issue-sd-jwt',
    title: 'Issue SD-JWT',
    summary: 'Mint a VC+SD-JWT credential and verify it.'
  },
  {
    id: 'issue-bbs',
    title: 'Issue BBS+',
    summary: 'Mint a DI+BBS credential and verify the selective-disclosure proof.'
  },
  {
    id: 'enable-relay',
    title: 'Enable Relay',
    summary: 'Restart the verifier with the local relay turned on and show the fetch path.'
  },
  {
    id: 'revoke-credential',
    title: 'Revoke Credential',
    summary: 'Flip the status-list bit and prove that verification now fails.'
  }
] as const

export type StepId = (typeof STEP_DEFS)[number]['id']

export function isStepId(value: string): value is StepId {
  return STEP_DEFS.some((step) => step.id === value)
}
