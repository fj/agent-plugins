import assert from 'node:assert/strict'
import { test } from 'node:test'

import { endsWithQuestion, stateAfterAnswer } from '../../src/core/state.ts'

test('an answer that ends with a question is waiting', () => {
  assert.equal(stateAfterAnswer('Shall I build it?'), 'waiting')
})

test('an answer that ends without a question is done', () => {
  assert.equal(stateAfterAnswer('Built and tested.'), 'done')
  assert.equal(stateAfterAnswer('Is it? Yes, it is.'), 'done')
  assert.equal(stateAfterAnswer(''), 'done')
})

test('trailing whitespace and markdown do not hide a question', () => {
  assert.ok(endsWithQuestion('Which one?\n\n'))
  assert.ok(endsWithQuestion('**Which one?**'))
  assert.ok(endsWithQuestion('Use `a` or `b` (which one?)'))
})
