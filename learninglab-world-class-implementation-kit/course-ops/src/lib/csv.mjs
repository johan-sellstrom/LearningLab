import fs from 'node:fs/promises'
import { parse } from 'csv-parse/sync'
import { z } from 'zod'

const rosterRowSchema = z.object({
  student_name: z.string(),
  student_email: z.string().email(),
  github_username: z.string().min(1),
  google_user_id: z.string().optional().nullable()
})

const githubIdentityRowSchema = z.object({
  student_email: z.string().email(),
  github_username: z.string().min(1),
  google_user_id: z.string().optional().nullable(),
  student_name: z.string().optional().nullable()
})

async function loadCsvRows(csvPath) {
  const text = await fs.readFile(csvPath, 'utf8')
  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  })
}

export async function loadRoster(rosterPath) {
  const rows = await loadCsvRows(rosterPath)

  return rows.map((row) => {
    const parsed = rosterRowSchema.parse(row)
    return {
      studentName: parsed.student_name,
      studentEmail: parsed.student_email.toLowerCase(),
      githubUsername: parsed.github_username,
      googleUserId: parsed.google_user_id || null
    }
  })
}

export async function loadGitHubIdentities(csvPath) {
  const rows = await loadCsvRows(csvPath)

  return rows.map((row) => {
    const parsed = githubIdentityRowSchema.parse(row)
    return {
      studentEmail: parsed.student_email.toLowerCase(),
      githubUsername: parsed.github_username,
      googleUserId: parsed.google_user_id || null,
      studentName: parsed.student_name ? parsed.student_name.trim() : null
    }
  })
}

export function renderRosterCsv(rows) {
  const header = ['student_name', 'student_email', 'github_username', 'google_user_id']
  const body = rows.map((row) => [
    row.studentName,
    row.studentEmail,
    row.githubUsername,
    row.googleUserId || ''
  ])

  return [header, ...body]
    .map((cells) => cells.map(escapeCsvValue).join(','))
    .join('\n')
    .concat('\n')
}

export function renderGitHubIdentityCsv(rows) {
  const header = ['student_email', 'github_username', 'google_user_id', 'student_name']
  const body = rows.map((row) => [
    row.studentEmail,
    row.githubUsername || '',
    row.googleUserId || '',
    row.studentName || ''
  ])

  return [header, ...body]
    .map((cells) => cells.map(escapeCsvValue).join(','))
    .join('\n')
    .concat('\n')
}

function escapeCsvValue(value) {
  const text = String(value ?? '')
  if (/[,"\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}
