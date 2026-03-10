import { classifyWorkflowRun } from './scoring.mjs'

const LAB_SEQUENCE = ['00', '01', '02', '03', '04', '05']

export function getNextLabId(currentLabId) {
  const index = LAB_SEQUENCE.indexOf(String(currentLabId || ''))
  if (index === -1 || index === LAB_SEQUENCE.length - 1) return null
  return LAB_SEQUENCE[index + 1]
}

export function summarizeRepoProgress({ repo, currentLabId, latestRun }) {
  const workflow = classifyWorkflowRun(latestRun)
  const nextLabId = getNextLabId(currentLabId)
  const readyToAdvance = workflow.state === 'success' && Boolean(nextLabId)

  return {
    repo,
    currentLabId: currentLabId || '',
    nextLabId: nextLabId || '',
    workflowState: workflow.state,
    workflowReason: workflow.reason,
    workflowStatus: latestRun?.status || null,
    workflowConclusion: latestRun?.conclusion || null,
    readyToAdvance,
    runUrl: latestRun?.html_url || ''
  }
}
