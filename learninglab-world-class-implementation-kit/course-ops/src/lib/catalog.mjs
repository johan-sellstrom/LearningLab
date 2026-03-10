import path from 'node:path'
import YAML from 'yaml'
import { z } from 'zod'
import { readText } from './fs.mjs'

const courseConfigSchema = z.object({
  course: z.object({
    name: z.string(),
    slug: z.string(),
    timezone: z.string()
  }),
  github: z.object({
    owner: z.string(),
    templateOwner: z.string(),
    templateRepo: z.string(),
    repoVisibility: z.enum(['public', 'private']).default('private'),
    workflowFile: z.string().default('classroom.yml'),
    defaultBranch: z.string().default('main'),
    addStudentAsCollaborator: z.boolean().default(true),
    collaboratorPermission: z.string().default('push'),
    includeAllTemplateBranches: z.boolean().default(false),
    topics: z.array(z.string()).default([])
  }),
  googleClassroom: z.object({
    courseId: z.string(),
    defaultState: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT')
  }),
  grading: z.object({
    successScorePercent: z.number().default(100),
    failureScorePercent: z.number().default(0),
    inProgressScorePercent: z.number().default(50),
    missingRunScorePercent: z.number().default(0),
    publishAssignedGrades: z.boolean().default(false)
  }),
  paths: z.object({
    artifactsDir: z.string().default('../artifacts')
  }),
  naming: z.object({
    studentRepoPattern: z.string().default('{{course.slug}}-{{assignment.slug}}-{{github_username}}')
  })
})

const assignmentSchema = z.object({
  id: z.string(),
  labId: z.string(),
  slug: z.string(),
  title: z.string(),
  summary: z.string(),
  studentSteps: z.array(z.string()).default([]),
  github: z.object({
    templateRef: z.string().default('main'),
    repoNamePattern: z.string().optional(),
    topics: z.array(z.string()).default([])
  }),
  googleClassroom: z.object({
    workType: z.string().default('ASSIGNMENT'),
    state: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
    maxPoints: z.number().default(100),
    dueDate: z.string().optional(),
    dueTime: z.string().optional(),
    materials: z.array(z.object({
      title: z.string().optional(),
      url: z.string().url()
    })).default([])
  })
})

export async function loadCourseConfig(configPath) {
  const text = await readText(configPath)
  const parsed = YAML.parse(text)
  const config = courseConfigSchema.parse(parsed)
  return { ...config, __filePath: configPath, __baseDir: path.dirname(configPath) }
}

export async function loadAssignment(assignmentPath) {
  const text = await readText(assignmentPath)
  const parsed = YAML.parse(text)
  const assignment = assignmentSchema.parse(parsed)
  return { ...assignment, __filePath: assignmentPath, __baseDir: path.dirname(assignmentPath) }
}

export function renderTemplate(text, context) {
  return String(text).replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, key) => {
    const value = key.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), context)
    return value == null ? '' : String(value)
  })
}

export function buildRepoName(courseConfig, assignment, rosterRow) {
  const pattern = assignment.github.repoNamePattern || courseConfig.naming.studentRepoPattern
  return renderTemplate(pattern, {
    course: courseConfig.course,
    assignment,
    github_username: rosterRow.githubUsername
  })
}

export function buildRepoDescription(courseConfig, assignment, rosterRow) {
  return `${courseConfig.course.name} — ${assignment.title} — ${rosterRow.studentName}`
}
