import test from 'node:test'
import assert from 'node:assert/strict'

import { buildCourseWorkPayload, buildGitHubClassroomMaterials } from '../src/lib/coursework.mjs'

test('buildGitHubClassroomMaterials appends invite and starter repo links when configured', () => {
  const materials = buildGitHubClassroomMaterials({
    inviteUrl: 'https://classroom.github.com/a/example',
    inviteTitle: 'GitHub Classroom invite',
    starterRepoUrl: 'https://github.com/advatar/LearningLab',
    starterRepoTitle: 'Starter template'
  })

  assert.deepEqual(materials, [
    {
      link: {
        title: 'GitHub Classroom invite',
        url: 'https://classroom.github.com/a/example'
      }
    },
    {
      link: {
        title: 'Starter template',
        url: 'https://github.com/advatar/LearningLab'
      }
    }
  ])
})

test('buildCourseWorkPayload keeps assignment materials and appends GitHub Classroom links', () => {
  const payload = buildCourseWorkPayload({
    courseConfig: {
      course: { name: 'Learning Lab 2026' }
    },
    assignment: {
      title: 'Lab 00',
      summary: 'Start here.',
      studentSteps: ['Step 1'],
      googleClassroom: {
        workType: 'ASSIGNMENT',
        maxPoints: 100,
        dueDate: '2026-09-15',
        dueTime: '21:59:00',
        materials: [
          {
            title: 'Lab handout',
            url: 'https://example.test/handout'
          }
        ]
      }
    },
    state: 'DRAFT',
    githubClassroom: {
      inviteUrl: 'https://classroom.github.com/a/example',
      inviteTitle: 'GitHub Classroom invite',
      starterRepoUrl: 'https://github.com/advatar/LearningLab',
      starterRepoTitle: 'Starter template'
    }
  })

  assert.deepEqual(payload.materials, [
    {
      link: {
        title: 'Lab handout',
        url: 'https://example.test/handout'
      }
    },
    {
      link: {
        title: 'GitHub Classroom invite',
        url: 'https://classroom.github.com/a/example'
      }
    },
    {
      link: {
        title: 'Starter template',
        url: 'https://github.com/advatar/LearningLab'
      }
    }
  ])
  assert.deepEqual(payload.dueDate, { year: 2026, month: 9, day: 15 })
  assert.deepEqual(payload.dueTime, { hours: 21, minutes: 59, seconds: 0 })
})
