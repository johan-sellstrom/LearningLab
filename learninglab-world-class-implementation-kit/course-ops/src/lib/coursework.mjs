import { renderCourseworkDescription } from './strings.mjs'

export function readGitHubClassroomConfig(env = process.env) {
  return {
    inviteUrl: String(env.GITHUB_CLASSROOM_INVITE_URL || '').trim(),
    inviteTitle: String(env.GITHUB_CLASSROOM_ASSIGNMENT_TITLE || '').trim(),
    starterRepoUrl: String(env.GITHUB_CLASSROOM_STARTER_REPO_URL || '').trim(),
    starterRepoTitle: String(env.GITHUB_CLASSROOM_STARTER_REPO_TITLE || '').trim()
  }
}

export function buildGitHubClassroomMaterials(config = {}) {
  const materials = []

  if (config.inviteUrl) {
    materials.push({
      link: {
        title: config.inviteTitle || 'GitHub Classroom assignment',
        url: config.inviteUrl
      }
    })
  }

  if (config.starterRepoUrl) {
    materials.push({
      link: {
        title: config.starterRepoTitle || 'Starter repository',
        url: config.starterRepoUrl
      }
    })
  }

  return materials
}

export function buildCourseWorkPayload({ courseConfig, assignment, state, githubClassroom = null }) {
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

  const extraMaterials = buildGitHubClassroomMaterials(githubClassroom || {})
  if (extraMaterials.length > 0) {
    courseWork.materials.push(...extraMaterials)
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
