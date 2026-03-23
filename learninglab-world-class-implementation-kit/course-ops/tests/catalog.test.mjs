import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { loadCourseConfig } from '../src/lib/catalog.mjs'

test('loadCourseConfig allows GOOGLE_CLASSROOM_COURSE_ID to override the file value', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-ops-catalog-'))
  const configPath = path.join(tempDir, 'course.config.yaml')
  const originalCourseId = process.env.GOOGLE_CLASSROOM_COURSE_ID

  await fs.writeFile(configPath, `course:
  name: "Learning Lab 2026"
  slug: "learninglab"
  timezone: "America/Los_Angeles"

github:
  owner: "advatar"
  templateOwner: "advatar"
  templateRepo: "LearningLab"
  repoVisibility: "private"
  workflowFile: "classroom.yml"
  defaultBranch: "main"
  addStudentAsCollaborator: true
  collaboratorPermission: "push"
  includeAllTemplateBranches: false
  topics: []

googleClassroom:
  courseId: "REPLACE_WITH_REAL_GOOGLE_CLASSROOM_COURSE_ID"
  defaultState: "DRAFT"

grading:
  successScorePercent: 100
  failureScorePercent: 0
  inProgressScorePercent: 50
  missingRunScorePercent: 0
  publishAssignedGrades: false

paths:
  artifactsDir: "../artifacts"

naming:
  studentRepoPattern: "{{course.slug}}-{{assignment.slug}}-{{github_username}}"
`, 'utf8')

  process.env.GOOGLE_CLASSROOM_COURSE_ID = 'course-from-env'

  try {
    const config = await loadCourseConfig(configPath)
    assert.equal(config.googleClassroom.courseId, 'course-from-env')
  } finally {
    if (originalCourseId === undefined) delete process.env.GOOGLE_CLASSROOM_COURSE_ID
    else process.env.GOOGLE_CLASSROOM_COURSE_ID = originalCourseId
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})

test('loadCourseConfig fails fast when the Classroom course ID is still a placeholder', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'course-ops-catalog-'))
  const configPath = path.join(tempDir, 'course.config.yaml')
  const originalCourseId = process.env.GOOGLE_CLASSROOM_COURSE_ID

  await fs.writeFile(configPath, `course:
  name: "Learning Lab 2026"
  slug: "learninglab"
  timezone: "America/Los_Angeles"

github:
  owner: "advatar"
  templateOwner: "advatar"
  templateRepo: "LearningLab"
  repoVisibility: "private"
  workflowFile: "classroom.yml"
  defaultBranch: "main"
  addStudentAsCollaborator: true
  collaboratorPermission: "push"
  includeAllTemplateBranches: false
  topics: []

googleClassroom:
  courseId: "REPLACE_WITH_REAL_GOOGLE_CLASSROOM_COURSE_ID"
  defaultState: "DRAFT"

grading:
  successScorePercent: 100
  failureScorePercent: 0
  inProgressScorePercent: 50
  missingRunScorePercent: 0
  publishAssignedGrades: false

paths:
  artifactsDir: "../artifacts"

naming:
  studentRepoPattern: "{{course.slug}}-{{assignment.slug}}-{{github_username}}"
`, 'utf8')

  delete process.env.GOOGLE_CLASSROOM_COURSE_ID

  try {
    await assert.rejects(
      () => loadCourseConfig(configPath),
      /Missing Google Classroom course ID/
    )
  } finally {
    if (originalCourseId === undefined) delete process.env.GOOGLE_CLASSROOM_COURSE_ID
    else process.env.GOOGLE_CLASSROOM_COURSE_ID = originalCourseId
    await fs.rm(tempDir, { recursive: true, force: true })
  }
})
