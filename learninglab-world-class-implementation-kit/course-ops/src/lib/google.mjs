import 'dotenv/config'
import fs from 'node:fs/promises'

const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || 'https://oauth2.googleapis.com/token'
const API_BASE = process.env.GOOGLE_CLASSROOM_API_BASE || 'https://classroom.googleapis.com'

let cachedAccessToken = null
let cachedAccessTokenExpiresAt = 0

export async function createGoogleClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error('Missing GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REFRESH_TOKEN')
  }

  async function getAccessToken() {
    if (cachedAccessToken && Date.now() < cachedAccessTokenExpiresAt - 30_000) {
      return cachedAccessToken
    }

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token'
    })

    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body
    })

    const json = await response.json()
    if (!response.ok) {
      throw new Error(`Google OAuth ${response.status} ${json?.error || response.statusText}`)
    }

    cachedAccessToken = json.access_token
    cachedAccessTokenExpiresAt = Date.now() + Number(json.expires_in || 3600) * 1000
    return cachedAccessToken
  }

  async function request(path, { method = 'GET', body = null, query = null } = {}) {
    const token = await getAccessToken()
    const url = new URL(`${API_BASE}${path}`)
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value != null) url.searchParams.set(key, String(value))
      }
    }

    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const text = await response.text()
    const json = text ? tryParseJson(text) : null
    if (!response.ok) {
      const detail = json?.error?.message || json?.message || text || response.statusText
      const error = new Error(`Google Classroom API ${response.status} ${detail}`)
      error.status = response.status
      error.body = json
      throw error
    }
    return json
  }

  return { request }
}

export async function createCourseWork(client, { courseId, courseWork }) {
  return client.request(`/v1/courses/${courseId}/courseWork`, {
    method: 'POST',
    body: courseWork
  })
}

export function buildCourseWorkPatch(courseWork) {
  const patchableFields = [
    'title',
    'description',
    'state',
    'dueDate',
    'dueTime',
    'scheduledTime',
    'maxPoints',
    'workType',
    'submissionModificationMode',
    'topicId',
    'gradingPeriodId'
  ]

  const body = {}
  const updateMask = []

  for (const field of patchableFields) {
    if (courseWork[field] !== undefined) {
      body[field] = courseWork[field]
      updateMask.push(field)
    }
  }

  if (updateMask.length === 0) {
    throw new Error('No coursework fields provided for patch')
  }

  return {
    body,
    updateMask: updateMask.join(',')
  }
}

export async function patchCourseWork(client, { courseId, courseWorkId, courseWork }) {
  const patch = buildCourseWorkPatch(courseWork)

  return client.request(`/v1/courses/${courseId}/courseWork/${courseWorkId}`, {
    method: 'PATCH',
    query: {
      updateMask: patch.updateMask
    },
    body: patch.body
  })
}

export async function listCourseStudents(client, { courseId }) {
  const students = []
  let pageToken = null

  do {
    const response = await client.request(`/v1/courses/${courseId}/students`, {
      query: pageToken ? { pageToken } : null
    })
    students.push(...(response?.students || []))
    pageToken = response?.nextPageToken || null
  } while (pageToken)

  return students
}

export async function listStudentSubmissions(client, { courseId, courseWorkId }) {
  const submissions = []
  let pageToken = null

  do {
    const response = await client.request(`/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`, {
      query: pageToken ? { pageToken } : null
    })
    submissions.push(...(response?.studentSubmissions || []))
    pageToken = response?.nextPageToken || null
  } while (pageToken)

  return submissions
}

export async function patchStudentSubmissionGrades(client, {
  courseId,
  courseWorkId,
  submissionId,
  draftGrade,
  assignedGrade
}) {
  const body = {}
  const updateMask = []

  if (draftGrade != null) {
    body.draftGrade = draftGrade
    updateMask.push('draftGrade')
  }
  if (assignedGrade != null) {
    body.assignedGrade = assignedGrade
    updateMask.push('assignedGrade')
  }
  if (updateMask.length === 0) {
    throw new Error('No grade fields provided')
  }

  return client.request(`/v1/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}`, {
    method: 'PATCH',
    query: {
      updateMask: updateMask.join(',')
    },
    body
  })
}

export function buildStudentSubmissionGradePatch({ submission, draftGrade, assignedGrade }) {
  const currentDraftGrade = submission?.draftGrade ?? null
  const currentAssignedGrade = submission?.assignedGrade ?? null
  const patch = {
    draftGrade: null,
    assignedGrade: null,
    updateMask: [],
    shouldPatch: false
  }

  if (draftGrade != null && Number(currentDraftGrade) !== Number(draftGrade)) {
    patch.draftGrade = draftGrade
    patch.updateMask.push('draftGrade')
    patch.shouldPatch = true
  }

  if (assignedGrade != null && Number(currentAssignedGrade) !== Number(assignedGrade)) {
    patch.assignedGrade = assignedGrade
    patch.updateMask.push('assignedGrade')
    patch.shouldPatch = true
  }

  return patch
}

export async function loadCourseWorkArtifact(courseworkPath) {
  const text = await fs.readFile(courseworkPath, 'utf8')
  return JSON.parse(text)
}

function tryParseJson(text) {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
