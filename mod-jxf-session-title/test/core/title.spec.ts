import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cleanTitle, titleRequest } from '../../src/core/title.ts'

const SETTINGS = { instructions: 'Name it.', maxPromptChars: 12, maxTitleChars: 20, maxReplyTokens: 64 }

test('the request joins the prompts and keeps the instructions as the system prompt', () => {
  assert.deepEqual(titleRequest([' fix  ', '', 'auth'], { ...SETTINGS, maxPromptChars: 100 }), {
    system: 'Name it.',
    prompt: '<request>\nfix\n\nauth\n</request>',
    maxTokens: 64,
  })
})

test('the request is cut to the prompt limit', () => {
  assert.equal(titleRequest(['a very long prompt indeed'], SETTINGS).prompt, '<request>\na very long \n</request>')
})

test('a title loses quotes, closing punctuation and extra lines', () => {
  assert.equal(cleanTitle('  "Fix   auth refresh."\nBecause it broke', 60), 'Fix auth refresh')
})

test('a title is cut to the title limit', () => {
  assert.equal(cleanTitle('Refactor the payment gateway adapters', 20), 'Refactor the payment')
})

test('an empty reply gives no title', () => {
  assert.equal(cleanTitle(' "" \n', 60), undefined)
})

test('a title loses a leading title label', () => {
  assert.equal(cleanTitle('Session title: Checking the naming plugin', 60), 'Checking the naming plugin')
  assert.equal(cleanTitle('Title: "Fix auth refresh"', 60), 'Fix auth refresh')
  assert.equal(cleanTitle('Titled sections in docs', 60), 'Titled sections in docs')
})
