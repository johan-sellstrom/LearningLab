import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCourseWorkPatch, buildStudentSubmissionGradePatch } from '../src/lib/google.mjs'

test('buildCourseWorkPatch selects only patchable coursework fields', () => {
  const patch = buildCourseWorkPatch({
    title: 'Lab 01 — SD-JWT Issuance',
    description: 'Updated description',
    state: 'DRAFT',
    dueDate: { year: 2026, month: 9, day: 15 },
    dueTime: { hours: 21, minutes: 59, seconds: 0 },
    maxPoints: 100,
    materials: [{ link: { url: 'https://example.test' } }]
  })

  assert.equal(
    patch.updateMask,
    'title,description,state,dueDate,dueTime,maxPoints'
  )
  assert.deepEqual(patch.body, {
    title: 'Lab 01 — SD-JWT Issuance',
    description: 'Updated description',
    state: 'DRAFT',
    dueDate: { year: 2026, month: 9, day: 15 },
    dueTime: { hours: 21, minutes: 59, seconds: 0 },
    maxPoints: 100
  })
})

test('buildCourseWorkPatch rejects empty payloads', () => {
  assert.throws(() => buildCourseWorkPatch({ materials: [] }), /No coursework fields provided/)
})

test('buildStudentSubmissionGradePatch skips unchanged grades', () => {
  const patch = buildStudentSubmissionGradePatch({
    submission: {
      draftGrade: 100,
      assignedGrade: 100
    },
    draftGrade: 100,
    assignedGrade: 100
  })

  assert.deepEqual(patch, {
    draftGrade: null,
    assignedGrade: null,
    updateMask: [],
    shouldPatch: false
  })
})

test('buildStudentSubmissionGradePatch includes only changed grade fields', () => {
  const patch = buildStudentSubmissionGradePatch({
    submission: {
      draftGrade: 50,
      assignedGrade: null
    },
    draftGrade: 100,
    assignedGrade: null
  })

  assert.deepEqual(patch, {
    draftGrade: 100,
    assignedGrade: null,
    updateMask: ['draftGrade'],
    shouldPatch: true
  })
})
