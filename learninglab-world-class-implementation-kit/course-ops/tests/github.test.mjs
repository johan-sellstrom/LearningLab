import test from 'node:test'
import assert from 'node:assert/strict'
import { assertRepositoryReusable } from '../src/lib/github.mjs'

test('assertRepositoryReusable accepts a matching repository with expected visibility', () => {
  const repository = assertRepositoryReusable(
    {
      full_name: 'acme/learninglab-lab-01-ada',
      private: true,
      archived: false,
      disabled: false
    },
    {
      owner: 'acme',
      repo: 'learninglab-lab-01-ada',
      expectedVisibility: 'private'
    }
  )

  assert.equal(repository.full_name, 'acme/learninglab-lab-01-ada')
})

test('assertRepositoryReusable rejects archived or visibility-mismatched repositories', () => {
  assert.throws(
    () => assertRepositoryReusable(
      {
        full_name: 'acme/learninglab-lab-01-ada',
        private: false,
        archived: true,
        disabled: false
      },
      {
        owner: 'acme',
        repo: 'learninglab-lab-01-ada',
        expectedVisibility: 'private'
      }
    ),
    /not safe to reuse/
  )
})
