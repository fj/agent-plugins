import assert from 'node:assert/strict'
import { test } from 'node:test'

import { branchFrom } from '../../../src/adapters/claude-code/git.ts'

const NOT_A_REPO = 128

test('the branch is the trimmed git output, and none when git fails or HEAD is detached', () => {
  assert.equal(branchFrom({ exitCode: 0, stdout: 'topic/x\n' }), 'topic/x')
  assert.equal(branchFrom({ exitCode: 0, stdout: '' }), null)
  assert.equal(branchFrom({ exitCode: NOT_A_REPO, stdout: '' }), null)
})
