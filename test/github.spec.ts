import assert from 'node:assert/strict'
import { test } from 'node:test'

import { githubRepoCreator } from '../scripts/lib/github.ts'
import { fakeRunner } from './helpers.ts'

test('repos are created as the owner with a token read once', () => {
  const fake = fakeRunner({ 'gh auth token --user fj': 'secret' })
  const create = githubRepoCreator(fake.run, 'fj')

  create('one', 'First.')
  create('two', 'Second.')

  assert.deepEqual(fake.calls, [
    'gh auth token --user fj',
    'gh repo create fj/one --public --description First.',
    'gh repo create fj/two --public --description Second.',
  ])
  assert.equal(fake.options[1]!.env!.GH_TOKEN, 'secret')
  assert.equal(fake.options[2]!.env!.GH_TOKEN, 'secret')
})
