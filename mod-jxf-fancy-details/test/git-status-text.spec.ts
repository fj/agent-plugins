import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { GitStatus } from '../src/core/git-status.ts'
import { gitStatusText } from '../src/render/git-status.ts'

const CLEAN: GitStatus = {
  conflicted: 0,
  stashed: 0,
  deleted: 0,
  renamed: 0,
  modified: 0,
  staged: 0,
  untracked: 0,
}
const EVERY_CHANGE: GitStatus = {
  conflicted: 1,
  stashed: 2,
  deleted: 3,
  renamed: 4,
  modified: 5,
  staged: 7,
  untracked: 8,
  ahead: 9,
  behind: 0,
}

test('changes show in fixed order with counts, then ahead', () => {
  assert.equal(gitStatusText(EVERY_CHANGE), '⇄⟨1⟩■⟨2⟩×⟨3⟩»⟨4⟩!⟨5⟩+⟨7⟩?⟨8⟩⇡⟨9⟩')
})

test('behind and diverged use own symbols and counts', () => {
  assert.equal(gitStatusText({ ...CLEAN, ahead: 0, behind: 2 }), '⇣⟨2⟩')
  assert.equal(gitStatusText({ ...CLEAN, modified: 1, ahead: 3, behind: 4 }), '!⟨1⟩⇕ ⇡3 ⇣4')
})

test('clean tree shows up-to-date mark only with upstream', () => {
  assert.equal(gitStatusText({ ...CLEAN, ahead: 0, behind: 0 }), '✓')
  assert.equal(gitStatusText(CLEAN), '')
})
