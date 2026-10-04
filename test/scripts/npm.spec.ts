import assert from 'node:assert/strict'
import { test } from 'node:test'

import { publishArgs } from '../../scripts/npm.ts'

test('a dry run asks npm for a dry-run publish', () => {
  assert.deepEqual(publishArgs(true), ['publish', '--dry-run'])
})

test('a real run asks npm for a plain publish', () => {
  assert.deepEqual(publishArgs(false), ['publish'])
})
