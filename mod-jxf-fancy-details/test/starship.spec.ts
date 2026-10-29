import assert from 'node:assert/strict'
import { test } from 'node:test'

import { gitStatusConfig, starshipConfigPath } from '../src/config/starship.ts'
import { tomlTable } from '../src/config/toml.ts'

import { STARSHIP_TOML } from './starship-fixture.ts'

test('toml table reads basic, literal and multi-line strings and booleans of one table only', () => {
  const toml = String.raw`
top = "outside"
[other]
format = "other"
[ "wanted" ] # comment
basic = "tab\there \"quoted\" \u00e9 back\\slash" # trailing comment
literal = 'C:\no\escapes'
multi = """
first \
  second"""
raw = '''
line 1
line 2'''
flag = true
number = 3
[[wanted]]
format = "array of tables"
`

  assert.deepEqual(tomlTable(toml, 'wanted'), {
    basic: 'tab\there "quoted" é back\\slash',
    literal: 'C:\\no\\escapes',
    multi: 'first second',
    raw: 'line 1\nline 2',
    flag: true,
  })
})

test('git status config takes user symbols and format', () => {
  const config = gitStatusConfig(STARSHIP_TOML)

  assert.equal(config.format, '([$all_status]($style))([$ahead_behind]($style blue)) ')
  assert.equal(config.isDisabled, false)
  assert.equal(config.symbols.modified, '!⟨${count}⟩')
  assert.equal(config.symbols.diverged, '⇕ ⇡${ahead_count} ⇣${behind_count}')
  assert.equal(config.symbols.up_to_date, '✓')
  assert.equal(config.symbols.typechanged, '')
})

test('git status config falls back to Starship defaults without file or table', () => {
  const defaults = {
    format: '$all_status$ahead_behind',
    isDisabled: false,
    symbols: {
      conflicted: '=',
      stashed: '\\$',
      deleted: '✘',
      renamed: '»',
      modified: '!',
      typechanged: '',
      staged: '+',
      untracked: '?',
      ahead: '⇡',
      behind: '⇣',
      diverged: '⇕',
      up_to_date: '',
    },
  }

  assert.deepEqual(gitStatusConfig(undefined), defaults)
  assert.deepEqual(gitStatusConfig('[directory]\nformat = "$path"\n'), defaults)
})

test('git status config honors disabled flag', () => {
  assert.equal(gitStatusConfig('[git_status]\ndisabled = true\n').isDisabled, true)
})

test('config path prefers STARSHIP_CONFIG over home default', () => {
  assert.equal(starshipConfigPath({ STARSHIP_CONFIG: '/etc/starship.toml' }, '/home/j'), '/etc/starship.toml')
  assert.equal(starshipConfigPath({}, '/home/j'), '/home/j/.config/starship.toml')
})
