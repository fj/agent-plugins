import assert from 'node:assert/strict'
import { test } from 'node:test'

import { DEFAULT_SETTINGS, parseConfig, parseConfigText } from '../src/config/config.ts'

test('no config gives the defaults and the harness default model', () => {
  assert.deepEqual(parseConfig(null, 'haiku'), { ...DEFAULT_SETTINGS, model: 'haiku' })
})

test('every option is read', () => {
  const value = { model: 'anthropic/claude-haiku-5-5', autoTitle: false, instructions: 'Name it.', maxPromptChars: 500, maxTitleChars: 30, maxReplyTokens: 32, timeoutMs: 5000 }

  assert.deepEqual(parseConfig(value, 'haiku'), {
    model: 'anthropic/claude-haiku-5-5',
    isAutomatic: false,
    instructions: 'Name it.',
    maxPromptChars: 500,
    maxTitleChars: 30,
    maxReplyTokens: 32,
    timeoutMs: 5000,
  })
})

test('options of the wrong shape fall back to the defaults', () => {
  const value = { model: '  ', autoTitle: 'no', instructions: 3, maxPromptChars: -1, maxTitleChars: 2.5, maxReplyTokens: 0, timeoutMs: '9' }

  assert.deepEqual(parseConfig(value, 'haiku'), { ...DEFAULT_SETTINGS, model: 'haiku' })
})

test('unreadable config text gives the defaults', () => {
  assert.deepEqual(parseConfigText('{not json', 'haiku'), { ...DEFAULT_SETTINGS, model: 'haiku' })
})
