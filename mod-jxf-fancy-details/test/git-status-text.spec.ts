import assert from 'node:assert/strict'
import { test } from 'node:test'

import { gitStatusConfig } from '../src/config/starship.ts'
import type { GitStatus } from '../src/core/git-status.ts'
import { gitStatusText } from '../src/render/git-status.ts'
import { STARSHIP_TOML } from './starship-fixture.ts'

const CLEAN: GitStatus = {
  conflicted: 0,
  stashed: 0,
  deleted: 0,
  renamed: 0,
  modified: 0,
  typechanged: 0,
  staged: 0,
  untracked: 0,
}
const EVERY_CHANGE: GitStatus = {
  conflicted: 1,
  stashed: 2,
  deleted: 3,
  renamed: 4,
  modified: 5,
  typechanged: 6,
  staged: 7,
  untracked: 8,
  ahead: 9,
  behind: 0,
}
const USER = gitStatusConfig(STARSHIP_TOML)
const DEFAULTS = gitStatusConfig(undefined)

test('user symbols keep Starship order with counts, then ahead', () => {
  assert.equal(gitStatusText(EVERY_CHANGE, USER), '⇄⟨1⟩■⟨2⟩×⟨3⟩»⟨4⟩!⟨5⟩+⟨7⟩?⟨8⟩⇡⟨9⟩')
})

test('behind and diverged use their own symbols and counts', () => {
  assert.equal(gitStatusText({ ...CLEAN, ahead: 0, behind: 2 }, USER), '⇣⟨2⟩')
  assert.equal(gitStatusText({ ...CLEAN, modified: 1, ahead: 3, behind: 4 }, USER), '!⟨1⟩⇕ ⇡3 ⇣4')
})

test('clean tree shows up-to-date symbol only with upstream', () => {
  assert.equal(gitStatusText({ ...CLEAN, ahead: 0, behind: 0 }, USER), '✓')
  assert.equal(gitStatusText(CLEAN, USER), '')
})

test('Starship defaults apply without user config', () => {
  assert.equal(gitStatusText({ ...EVERY_CHANGE, ahead: 1, behind: 1 }, DEFAULTS), '=$✘»!+?⇕')
  assert.equal(gitStatusText({ ...CLEAN, ahead: 0, behind: 0 }, DEFAULTS), '')
})

test('disabled module shows nothing', () => {
  assert.equal(gitStatusText(EVERY_CHANGE, { ...USER, isDisabled: true }), '')
})

test('format honors escapes, bare variables, styles and empty conditionals', () => {
  const config = { ...USER, format: '\\($modified\\)[ ($untracked)]($style)(<$staged>) ' }

  assert.equal(gitStatusText({ ...CLEAN, modified: 1 }, config), '(!⟨1⟩)')
  assert.equal(gitStatusText({ ...CLEAN, staged: 2, untracked: 1 }, config), '() ?⟨1⟩<+⟨2⟩>')
})
