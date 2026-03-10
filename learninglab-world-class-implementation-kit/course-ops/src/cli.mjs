#!/usr/bin/env node
import path from 'node:path'
import 'dotenv/config'

import { parseArgs, usage } from './lib/args.mjs'
import { loadCourseConfig, loadAssignment, buildRepoName, buildRepoDescription } from './lib/catalog.mjs'
import { loadRoster, loadGitHubIdentities, renderRosterCsv } from './lib/csv.mjs'
import { ensureDir, absoluteFrom, writeJson, writeText, readJson } from './lib/fs.mjs'
import { renderCourseworkDescription, renderPlanMarkdown } from './lib/strings.mjs'
import {
  createGitHubClient,
  createRepoFromTemplate,
  getRepository,
  assertRepositoryReusable,
  getRepositoryVariable,
  upsertRepositoryVariable,
  addCollaborator,
  replaceTopics,
  fetchLatestWorkflowRun
} from './lib/github.mjs'
import {
  createGoogleClient,
  buildCourseWorkPatch,
  createCourseWork,
  patchCourseWork,
  listCourseStudents,
  listStudentSubmissions,
  buildStudentSubmissionGradePatch,
  patchStudentSubmissionGrades,
  loadCourseWorkArtifact
} from './lib/google.mjs'
import { scoreWorkflowRun } from './lib/scoring.mjs'
import { summarizeRepoProgress } from './lib/progress.mjs'
import {
  normalizeGoogleRoster,
  joinGoogleRosterWithGitHubIdentities,
  hasBlockingJoinIssues,
  summarizeProvisioningRoster,
  hasBlockingProvisioningIssues
} from './lib/roster.mjs'

main().catch((error) => {
  console.error(`[course-ops] FAILED: ${error?.message || error}`)
  process.exitCode = 1
})

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help || args.command === 'help') {
    console.log(usage())
    return
  }

  if (!args.config) throw new Error('--config is required')
  const courseConfig = await loadCourseConfig(path.resolve(args.config))
  const assignment = await loadAssignmentIfNeeded(args)

  switch (args.command) {
    case 'import-google-roster':
      await handleImportGoogleRoster({ args, courseConfig })
      return
    case 'join-identities':
      await handleJoinIdentities({ args, courseConfig })
      return
    case 'validate':
      await handleValidate({ args, courseConfig, assignment })
      return
    case 'plan':
      await handlePlan({ args, courseConfig, assignment })
      return
    case 'provision-github':
      await handleProvisionGitHub({ args, courseConfig, assignment })
      return
    case 'progress':
      await handleProgress({ args, courseConfig })
      return
    case 'publish-google':
      await handlePublishGoogle({ args, courseConfig, assignment })
      return
    case 'patch-google':
      await handlePatchGoogle({ args, courseConfig, assignment })
      return
    case 'sync-grades':
      await handleSyncGrades({ args, courseConfig, assignment })
      return
    default:
      throw new Error(`Unknown command: ${args.command}`)
  }
}

async function loadAssignmentIfNeeded(args) {
  const commandsThatRequireAssignment = new Set([
    'validate',
    'plan',
    'provision-github',
    'publish-google',
    'patch-google',
    'sync-grades'
  ])

  if (!commandsThatRequireAssignment.has(args.command)) return null
  if (!args.assignment) throw new Error('--assignment is required')
  return loadAssignment(path.resolve(args.assignment))
}

async function handleImportGoogleRoster({ args, courseConfig }) {
  const client = createGoogleClient()
  const students = await listCourseStudents(client, {
    courseId: courseConfig.googleClassroom.courseId
  })

  const roster = normalizeGoogleRoster(students)
  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(
      courseConfig.__baseDir,
      courseConfig.paths.artifactsDir,
      `google-roster.${courseConfig.googleClassroom.courseId}.json`
    )

  await writeJson(out, {
    generatedAt: new Date().toISOString(),
    course: courseConfig.course,
    courseId: courseConfig.googleClassroom.courseId,
    students: roster
  })
  console.log(`[course-ops] wrote ${out}`)
}

async function handleJoinIdentities({ args, courseConfig }) {
  if (!args.googleRoster) throw new Error('--google-roster is required for join-identities')
  if (!args.identities) throw new Error('--identities is required for join-identities')

  const googleRosterPath = path.resolve(args.googleRoster)
  const identitiesPath = path.resolve(args.identities)
  const googleRosterArtifact = await readJson(googleRosterPath)
  const identities = await loadGitHubIdentities(identitiesPath)

  const joinResult = joinGoogleRosterWithGitHubIdentities({
    googleRoster: googleRosterArtifact.students || [],
    identities
  })

  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(
      courseConfig.__baseDir,
      courseConfig.paths.artifactsDir,
      `joined-roster.${courseConfig.googleClassroom.courseId}.csv`
    )
  const reportOut = args.reportOut
    ? path.resolve(args.reportOut)
    : path.resolve(
      courseConfig.__baseDir,
      courseConfig.paths.artifactsDir,
      `joined-roster.${courseConfig.googleClassroom.courseId}.report.json`
    )

  const report = {
    generatedAt: new Date().toISOString(),
    course: courseConfig.course,
    courseId: courseConfig.googleClassroom.courseId,
    googleRosterPath,
    identitiesPath,
    counts: {
      googleStudents: (googleRosterArtifact.students || []).length,
      identityRows: identities.length,
      matchedRoster: joinResult.matchedRoster.length,
      missingGitHubIdentities: joinResult.missingGitHubIdentities.length
    },
    blockingIssues: joinResult.blockingIssues,
    missingGitHubIdentities: joinResult.missingGitHubIdentities,
    matchedRoster: joinResult.matchedRoster
  }

  await writeJson(reportOut, report)

  if (hasBlockingJoinIssues(joinResult)) {
    throw new Error(`Identity join blocked; see ${reportOut}`)
  }

  await writeText(out, renderRosterCsv(joinResult.matchedRoster))
  console.log(`[course-ops] wrote ${out}`)
  console.log(`[course-ops] wrote ${reportOut}`)
}

async function handleValidate({ args, courseConfig, assignment }) {
  let rosterSummary = null
  if (args.roster) {
    const roster = await loadRoster(path.resolve(args.roster))
    rosterSummary = summarizeProvisioningRoster(roster)
  }

  console.log(JSON.stringify({
    ok: rosterSummary ? !hasBlockingProvisioningIssues(rosterSummary) : true,
    course: courseConfig.course.name,
    assignment: assignment.title,
    labId: assignment.labId,
    roster: rosterSummary
  }, null, 2))
}

async function handlePlan({ args, courseConfig, assignment }) {
  if (!args.roster) throw new Error('--roster is required for plan')
  const roster = await loadRoster(path.resolve(args.roster))
  const rosterSummary = summarizeProvisioningRoster(roster)
  const repoPlan = roster.map((row) => ({
    ...row,
    repoName: buildRepoName(courseConfig, assignment, row)
  }))

  const markdown = renderPlanMarkdown({ courseConfig, assignment, roster, repoPlan, rosterSummary })
  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(courseConfig.__baseDir, courseConfig.paths.artifactsDir, `plan.${assignment.id}.md`)

  await writeText(out, markdown)
  console.log(`[course-ops] wrote ${out}`)
}

async function handleProvisionGitHub({ args, courseConfig, assignment }) {
  if (!args.roster) throw new Error('--roster is required for provision-github')
  const roster = await loadRoster(path.resolve(args.roster))
  const client = args.dryRun ? null : createGitHubClient()
  const results = []

  for (const row of roster) {
    const repoName = buildRepoName(courseConfig, assignment, row)
    const repoFullName = `${courseConfig.github.owner}/${repoName}`
    const description = buildRepoDescription(courseConfig, assignment, row)
    const [owner, repoOnly] = repoFullName.split('/')

    if (args.dryRun) {
      results.push({
        mode: 'dry-run',
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        githubUsername: row.githubUsername,
        googleUserId: row.googleUserId,
        repoOwner: courseConfig.github.owner,
        repoName,
        repoFullName,
        repoUrl: `https://github.com/${repoFullName}`,
        labId: assignment.labId
      })
      continue
    }

    let repo = null
    let repoLifecycle = 'created'
    try {
      repo = await createRepoFromTemplate(client, {
        templateOwner: courseConfig.github.templateOwner,
        templateRepo: courseConfig.github.templateRepo,
        owner: courseConfig.github.owner,
        name: repoName,
        description,
        isPrivate: courseConfig.github.repoVisibility === 'private',
        includeAllBranches: courseConfig.github.includeAllTemplateBranches
      })
    } catch (error) {
      if (error.status === 422) {
        repo = assertRepositoryReusable(
          await getRepository(client, {
            owner,
            repo: repoOnly
          }),
          {
            owner,
            repo: repoOnly,
            expectedVisibility: courseConfig.github.repoVisibility
          }
        )
        repoLifecycle = 'reused'
      } else {
        throw error
      }
    }

    await upsertRepositoryVariable(client, {
      owner,
      repo: repoOnly,
      name: 'LAB_ID',
      value: assignment.labId
    })

    const topics = Array.from(new Set([
      ...(courseConfig.github.topics || []),
      ...(assignment.github.topics || [])
    ]))

    if (topics.length > 0) {
      await replaceTopics(client, {
        owner,
        repo: repoOnly,
        names: topics
      })
    }

    if (courseConfig.github.addStudentAsCollaborator && row.githubUsername) {
      await addCollaborator(client, {
        owner,
        repo: repoOnly,
        username: row.githubUsername,
        permission: courseConfig.github.collaboratorPermission
      })
    }

    results.push({
      mode: 'apply',
      repoLifecycle,
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      githubUsername: row.githubUsername,
      googleUserId: row.googleUserId,
      repoOwner: owner,
      repoName: repoOnly,
      repoFullName,
      repoUrl: repo?.html_url || `https://github.com/${repoFullName}`,
      labId: assignment.labId
    })
  }

  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(courseConfig.__baseDir, courseConfig.paths.artifactsDir, `repo-map.${assignment.id}.json`)

  await writeJson(out, {
    generatedAt: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    course: courseConfig.course,
    assignment: { id: assignment.id, labId: assignment.labId, title: assignment.title },
    repos: results
  })
  console.log(`[course-ops] wrote ${out}`)
}

async function handleProgress({ args, courseConfig }) {
  if (!args.repoMap) throw new Error('--repo-map is required for progress')

  const repoMapPath = path.resolve(args.repoMap)
  const repoMap = await readJson(repoMapPath)
  const client = createGitHubClient()
  const repoProgress = []

  for (const row of repoMap.repos || []) {
    const owner = row.repoOwner
    const repo = row.repoName
    if (!owner || !repo) {
      throw new Error(`Repo map entry is missing repoOwner or repoName for ${row.studentEmail || row.studentName || 'unknown student'}`)
    }

    const [currentLabId, latestRun] = await Promise.all([
      getRepositoryVariable(client, {
        owner,
        repo,
        name: 'LAB_ID'
      }),
      fetchLatestWorkflowRun(client, {
        owner,
        repo,
        workflowFile: courseConfig.github.workflowFile,
        branch: courseConfig.github.defaultBranch
      })
    ])

    repoProgress.push({
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      githubUsername: row.githubUsername,
      googleUserId: row.googleUserId || null,
      repoOwner: owner,
      repoName: repo,
      repoFullName: row.repoFullName || `${owner}/${repo}`,
      repoUrl: row.repoUrl || `https://github.com/${owner}/${repo}`,
      ...summarizeRepoProgress({
        repo: `${owner}/${repo}`,
        currentLabId,
        latestRun
      })
    })
  }

  const counts = repoProgress.reduce((summary, row) => {
    summary.total += 1
    summary.workflowStates[row.workflowState] = (summary.workflowStates[row.workflowState] || 0) + 1
    if (row.readyToAdvance) summary.readyToAdvance += 1
    if (!row.currentLabId) summary.missingLabId += 1
    return summary
  }, {
    total: 0,
    readyToAdvance: 0,
    missingLabId: 0,
    workflowStates: {}
  })

  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(
      courseConfig.__baseDir,
      courseConfig.paths.artifactsDir,
      `progress.${repoMap.assignment?.id || courseConfig.course.slug}.json`
    )

  await writeJson(out, {
    generatedAt: new Date().toISOString(),
    course: courseConfig.course,
    assignment: repoMap.assignment || null,
    repoMapPath,
    workflowFile: courseConfig.github.workflowFile,
    workflowBranch: courseConfig.github.defaultBranch,
    counts,
    repos: repoProgress
  })
  console.log(`[course-ops] wrote ${out}`)
}

async function handlePublishGoogle({ args, courseConfig, assignment }) {
  const state = args.state || assignment.googleClassroom.state || courseConfig.googleClassroom.defaultState
  const courseWork = buildCourseWorkPayload({ courseConfig, assignment, state })

  let result
  if (args.dryRun) {
    result = {
      mode: 'dry-run',
      courseId: courseConfig.googleClassroom.courseId,
      courseWork
    }
  } else {
    const client = createGoogleClient()
    result = await createCourseWork(client, {
      courseId: courseConfig.googleClassroom.courseId,
      courseWork
    })
  }

  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(courseConfig.__baseDir, courseConfig.paths.artifactsDir, `coursework.${assignment.id}.json`)

  await writeJson(out, result)
  console.log(`[course-ops] wrote ${out}`)
}

async function handlePatchGoogle({ args, courseConfig, assignment }) {
  if (!args.coursework && !args.courseworkId) throw new Error('--coursework or --coursework-id is required for patch-google')

  const courseWorkId = args.courseworkId || String((await loadCourseWorkArtifact(path.resolve(args.coursework))).id || '')
  if (!courseWorkId) throw new Error('Could not determine courseWorkId')

  const state = args.state || assignment.googleClassroom.state || courseConfig.googleClassroom.defaultState
  const courseWork = buildCourseWorkPayload({ courseConfig, assignment, state })
  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(courseConfig.__baseDir, courseConfig.paths.artifactsDir, `coursework.${assignment.id}.patch.json`)

  let result
  if (args.dryRun) {
    const patch = buildCourseWorkPatch(courseWork)
    result = {
      mode: 'dry-run',
      courseId: courseConfig.googleClassroom.courseId,
      courseWorkId,
      updateMask: patch.updateMask,
      courseWork: patch.body
    }
  } else {
    const client = createGoogleClient()
    result = await patchCourseWork(client, {
      courseId: courseConfig.googleClassroom.courseId,
      courseWorkId,
      courseWork
    })
  }

  await writeJson(out, result)
  console.log(`[course-ops] wrote ${out}`)
}

function buildCourseWorkPayload({ courseConfig, assignment, state }) {
  const courseWork = {
    title: assignment.title,
    description: renderCourseworkDescription(courseConfig, assignment),
    workType: assignment.googleClassroom.workType,
    state,
    maxPoints: assignment.googleClassroom.maxPoints,
    materials: (assignment.googleClassroom.materials || []).map((material) => ({
      link: {
        title: material.title,
        url: material.url
      }
    }))
  }

  if (assignment.googleClassroom.dueDate) {
    const [year, month, day] = assignment.googleClassroom.dueDate.split('-').map(Number)
    courseWork.dueDate = { year, month, day }
  }

  if (assignment.googleClassroom.dueTime) {
    const [hours, minutes, seconds = '0'] = assignment.googleClassroom.dueTime.split(':')
    courseWork.dueTime = { hours: Number(hours), minutes: Number(minutes), seconds: Number(seconds) }
  }

  return courseWork
}

async function handleSyncGrades({ args, courseConfig, assignment }) {
  if (!args.repoMap) throw new Error('--repo-map is required for sync-grades')
  if (!args.coursework && !args.courseworkId) throw new Error('--coursework or --coursework-id is required for sync-grades')

  const repoMapPath = path.resolve(args.repoMap)
  const repoMap = await readJson(repoMapPath)
  const courseWorkId = args.courseworkId || String((await loadCourseWorkArtifact(path.resolve(args.coursework))).id || '')
  if (!courseWorkId) throw new Error('Could not determine courseWorkId')

  const github = createGitHubClient()
  const google = createGoogleClient()

  const [students, submissions] = await Promise.all([
    listCourseStudents(google, { courseId: courseConfig.googleClassroom.courseId }),
    listStudentSubmissions(google, {
      courseId: courseConfig.googleClassroom.courseId,
      courseWorkId
    })
  ])

  const studentsByEmail = new Map(
    students
      .filter((student) => student?.profile?.emailAddress)
      .map((student) => [String(student.profile.emailAddress).toLowerCase(), student])
  )

  const submissionsByUserId = new Map(
    submissions
      .filter((submission) => submission?.userId)
      .map((submission) => [String(submission.userId), submission])
  )

  const report = []

  for (const row of repoMap.repos || []) {
    const latestRun = await fetchLatestWorkflowRun(github, {
      owner: row.repoOwner,
      repo: row.repoName,
      workflowFile: courseConfig.github.workflowFile,
      branch: courseConfig.github.defaultBranch
    })

    const score = scoreWorkflowRun({
      run: latestRun,
      maxPoints: Number(assignment.googleClassroom.maxPoints || 100),
      grading: courseConfig.grading
    })

    const matchSource = row.googleUserId ? 'google_user_id' : 'email'
    const student = row.googleUserId
      ? { userId: row.googleUserId }
      : studentsByEmail.get(String(row.studentEmail).toLowerCase())

    const submission = student ? submissionsByUserId.get(String(student.userId)) : null

    if (args.dryRun || !submission) {
      report.push({
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        repo: `${row.repoOwner}/${row.repoName}`,
        workflowStatus: latestRun?.status || null,
        workflowConclusion: latestRun?.conclusion || null,
        computedDraftGrade: score.draftGrade,
        computedAssignedGrade: score.assignedGrade,
        currentDraftGrade: submission?.draftGrade ?? null,
        currentAssignedGrade: submission?.assignedGrade ?? null,
        googleUserId: student?.userId || null,
        submissionId: submission?.id || null,
        matchSource: student ? matchSource : 'unmatched',
        mode: args.dryRun ? 'dry-run' : 'skipped',
        reason: !submission ? 'No matching student submission found' : score.reason
      })
      continue
    }

    const gradePatch = buildStudentSubmissionGradePatch({
      submission,
      draftGrade: score.draftGrade,
      assignedGrade: score.assignedGrade
    })

    if (!gradePatch.shouldPatch) {
      report.push({
        studentName: row.studentName,
        studentEmail: row.studentEmail,
        repo: `${row.repoOwner}/${row.repoName}`,
        workflowStatus: latestRun?.status || null,
        workflowConclusion: latestRun?.conclusion || null,
        computedDraftGrade: score.draftGrade,
        computedAssignedGrade: score.assignedGrade,
        currentDraftGrade: submission?.draftGrade ?? null,
        currentAssignedGrade: submission?.assignedGrade ?? null,
        googleUserId: student?.userId || null,
        submissionId: submission?.id || null,
        matchSource,
        mode: 'no-op',
        reason: 'Draft and assigned grades are already up to date'
      })
      continue
    }

    const patched = await patchStudentSubmissionGrades(google, {
      courseId: courseConfig.googleClassroom.courseId,
      courseWorkId,
      submissionId: submission.id,
      draftGrade: gradePatch.draftGrade,
      assignedGrade: gradePatch.assignedGrade
    })

    report.push({
      studentName: row.studentName,
      studentEmail: row.studentEmail,
      repo: `${row.repoOwner}/${row.repoName}`,
      workflowStatus: latestRun?.status || null,
      workflowConclusion: latestRun?.conclusion || null,
      computedDraftGrade: score.draftGrade,
      computedAssignedGrade: score.assignedGrade,
      currentDraftGrade: submission?.draftGrade ?? null,
      currentAssignedGrade: submission?.assignedGrade ?? null,
      googleUserId: student?.userId || null,
      submissionId: submission?.id || null,
      patchedSubmissionId: patched?.id || submission?.id,
      matchSource,
      mode: 'apply',
      reason: score.reason
    })
  }

  const out = args.out
    ? path.resolve(args.out)
    : path.resolve(courseConfig.__baseDir, courseConfig.paths.artifactsDir, `grade-sync.${assignment.id}.json`)

  await writeJson(out, {
    generatedAt: new Date().toISOString(),
    mode: args.dryRun ? 'dry-run' : 'apply',
    courseWorkId,
    report
  })
  console.log(`[course-ops] wrote ${out}`)
}
