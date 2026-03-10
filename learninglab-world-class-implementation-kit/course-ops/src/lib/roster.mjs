import { z } from 'zod'

const googleStudentSchema = z.object({
  userId: z.string().min(1),
  profile: z.object({
    emailAddress: z.string().email().optional(),
    name: z.object({
      fullName: z.string().min(1).optional()
    }).optional()
  }).optional()
})

export function normalizeGoogleRoster(students) {
  return students
    .map((student) => {
      const parsed = googleStudentSchema.parse(student)
      const studentEmail = String(parsed.profile?.emailAddress || '').trim().toLowerCase()
      const studentName = String(parsed.profile?.name?.fullName || '').trim()

      if (!studentEmail) {
        throw new Error(
          `Google Classroom student ${parsed.userId} is missing profile.emailAddress; ensure classroom.profile.emails scope is granted`
        )
      }

      if (!studentName) {
        throw new Error(`Google Classroom student ${parsed.userId} is missing profile.name.fullName`)
      }

      return {
        googleUserId: parsed.userId,
        studentName,
        studentEmail
      }
    })
    .sort((a, b) => a.studentEmail.localeCompare(b.studentEmail))
}

export function joinGoogleRosterWithGitHubIdentities({ googleRoster, identities }) {
  const duplicateGoogleEmails = findDuplicateValues(googleRoster.map((row) => row.studentEmail))
  const duplicateGoogleUserIds = findDuplicateValues(googleRoster.map((row) => row.googleUserId))
  const duplicateIdentityEmails = findDuplicateValues(identities.map((row) => row.studentEmail))
  const duplicateIdentityGoogleUserIds = findDuplicateValues(
    identities.map((row) => row.googleUserId).filter(Boolean)
  )
  const duplicateGitHubUsernames = findDuplicateValues(identities.map((row) => row.githubUsername))

  const identitiesByEmail = new Map(identities.map((row) => [row.studentEmail, row]))
  const identitiesByGoogleUserId = new Map(
    identities
      .filter((row) => row.googleUserId)
      .map((row) => [row.googleUserId, row])
  )

  const matchedRoster = []
  const missingGitHubIdentities = []

  for (const student of googleRoster) {
    const identity = identitiesByGoogleUserId.get(student.googleUserId) || identitiesByEmail.get(student.studentEmail)
    if (!identity) {
      missingGitHubIdentities.push(student)
      continue
    }

    matchedRoster.push({
      studentName: student.studentName,
      studentEmail: student.studentEmail,
      githubUsername: identity.githubUsername,
      googleUserId: student.googleUserId
    })
  }

  return {
    matchedRoster,
    missingGitHubIdentities,
    blockingIssues: {
      duplicateGoogleEmails,
      duplicateGoogleUserIds,
      duplicateIdentityEmails,
      duplicateIdentityGoogleUserIds,
      duplicateGitHubUsernames
    }
  }
}

export function hasBlockingJoinIssues(joinResult) {
  return (
    joinResult.missingGitHubIdentities.length > 0 ||
    Object.values(joinResult.blockingIssues).some((values) => values.length > 0)
  )
}

export function summarizeProvisioningRoster(roster) {
  const duplicateStudentEmails = findDuplicateValues(roster.map((row) => row.studentEmail))
  const duplicateGitHubUsernames = findDuplicateValues(roster.map((row) => row.githubUsername))
  const duplicateGoogleUserIds = findDuplicateValues(
    roster.map((row) => row.googleUserId).filter(Boolean)
  )
  const missingGoogleUserIds = roster.filter((row) => !row.googleUserId)

  return {
    counts: {
      students: roster.length,
      missingGoogleUserIds: missingGoogleUserIds.length
    },
    blockingIssues: {
      duplicateStudentEmails,
      duplicateGitHubUsernames,
      duplicateGoogleUserIds
    },
    warnings: {
      missingGoogleUserIds
    }
  }
}

export function hasBlockingProvisioningIssues(summary) {
  return Object.values(summary.blockingIssues).some((values) => values.length > 0)
}

function findDuplicateValues(values) {
  const counts = new Map()
  for (const value of values) {
    const key = String(value || '').trim()
    if (!key) continue
    counts.set(key, (counts.get(key) || 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort()
}
