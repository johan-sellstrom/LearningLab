export function renderCourseworkDescription(courseConfig, assignment) {
  const lines = [
    `${assignment.summary}`,
    '',
    '## What you should do',
    ...assignment.studentSteps.map((step, index) => `${index + 1}. ${step}`),
    '',
    '## Submission and grading',
    '- Work in your provisioned GitHub repository.',
    '- Push regularly; GitHub Actions is the grading signal.',
    '- Draft grades may appear before assigned grades are published.'
  ]
  return lines.join('\n')
}

export function renderPlanMarkdown({ courseConfig, assignment, roster, repoPlan, rosterSummary }) {
  const lines = [
    `# Release plan — ${assignment.title}`,
    '',
    `- Course: ${courseConfig.course.name}`,
    `- Assignment ID: ${assignment.id}`,
    `- Lab ID: ${assignment.labId}`,
    `- Dry-run only: yes`,
    `- Students: ${rosterSummary?.counts?.students ?? roster.length}`,
    '',
    '## Repo plan',
    '',
    '| Student | Email | GitHub username | Google user ID | Repo name |',
    '|---|---|---|---|---|'
  ]

  for (const row of repoPlan) {
    lines.push(`| ${row.studentName} | ${row.studentEmail} | ${row.githubUsername} | ${row.googleUserId || 'missing'} | ${row.repoName} |`)
  }

  lines.push('', '## Notes', '', '- Review repo names and collaborator mappings before running with `--apply`.')

  const missingGoogleUserIds = rosterSummary?.warnings?.missingGoogleUserIds || []
  if (missingGoogleUserIds.length > 0) {
    lines.push(`- ${missingGoogleUserIds.length} roster entries are missing Google user IDs; grade sync will fall back to email matching for those students.`)
  }

  const blockingIssues = rosterSummary?.blockingIssues || {}
  const blockingLines = [
    ['Duplicate student emails', blockingIssues.duplicateStudentEmails || []],
    ['Duplicate GitHub usernames', blockingIssues.duplicateGitHubUsernames || []],
    ['Duplicate Google user IDs', blockingIssues.duplicateGoogleUserIds || []]
  ].filter(([, values]) => values.length > 0)

  if (blockingLines.length > 0) {
    lines.push('', '## Blocking issues')
    for (const [label, values] of blockingLines) {
      lines.push(`- ${label}: ${values.join(', ')}`)
    }
  }

  return lines.join('\n')
}
