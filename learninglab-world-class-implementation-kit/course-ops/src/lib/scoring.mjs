export function classifyWorkflowRun(run) {
  if (!run) {
    return {
      state: 'missing',
      reason: 'No workflow run found'
    }
  }

  if (run.status !== 'completed') {
    return {
      state: 'in_progress',
      reason: `Workflow status is ${run.status}`
    }
  }

  if (run.conclusion === 'success') {
    return {
      state: 'success',
      reason: 'Workflow concluded success'
    }
  }

  return {
    state: run.conclusion || 'failed',
    reason: `Workflow concluded ${run.conclusion || 'without a conclusion'}`
  }
}

export function scoreWorkflowRun({ run, maxPoints, grading }) {
  const successScore = roundScore(maxPoints * Number(grading.successScorePercent || 0) / 100)
  const failureScore = roundScore(maxPoints * Number(grading.failureScorePercent || 0) / 100)
  const inProgressScore = roundScore(maxPoints * Number(grading.inProgressScorePercent || 0) / 100)
  const missingRunScore = roundScore(maxPoints * Number(grading.missingRunScorePercent || 0) / 100)
  const classification = classifyWorkflowRun(run)

  if (classification.state === 'missing') {
    return {
      ...classification,
      draftGrade: missingRunScore,
      assignedGrade: grading.publishAssignedGrades ? missingRunScore : null
    }
  }

  if (classification.state === 'in_progress') {
    return {
      ...classification,
      draftGrade: inProgressScore,
      assignedGrade: grading.publishAssignedGrades ? inProgressScore : null
    }
  }

  if (classification.state === 'success') {
    return {
      ...classification,
      draftGrade: successScore,
      assignedGrade: grading.publishAssignedGrades ? successScore : null
    }
  }

  return {
    ...classification,
    draftGrade: failureScore,
    assignedGrade: grading.publishAssignedGrades ? failureScore : null
  }
}

function roundScore(value) {
  return Math.round(value * 100) / 100
}
