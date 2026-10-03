import assert from 'node:assert/strict'
import { test } from 'node:test'

import { addMark, EMPTY_LEDGER, startStep, submitPrompt } from '../src/core/ledger.ts'
import {
  aliasRow,
  appendKeyText,
  EMPTY_ROWS,
  markIds,
  noteText,
  pendingMessageMark,
  pendingPrompt,
  resolveRow,
} from '../src/core/rows.ts'

test('stored text keys ignore whitespace differences and keep a bounded head', () => {
  const long = 'x'.repeat(200)
  const rows = noteText(noteText(EMPTY_ROWS, 'a', '  hello \n\n world  '), 'b', long + 'A')

  assert.equal(resolveRow(rows, 'r', 'hello world', ['a', 'b']), 'a')
  assert.equal(resolveRow(rows, 'r', long + 'B', ['a', 'b']), 'b')
})

test('appendKeyText stops growing once the key is long enough', () => {
  const full = appendKeyText('', 'x'.repeat(200))

  assert.equal(appendKeyText(full, 'more'), full)
  assert.equal(appendKeyText('ab', 'cd'), 'abcd')
})

test('resolveRow prefers an alias over a text match', () => {
  let rows = noteText(EMPTY_ROWS, 'p1', 'fix the bug')
  rows = noteText(rows, 'p2', 'fix the bug')
  rows = aliasRow(rows, 'row-a', 'p1')

  assert.equal(resolveRow(rows, 'row-a', 'fix the bug', ['p1', 'p2']), 'p1')
})

test('resolveRow falls back to the latest id whose text matches', () => {
  let rows = noteText(EMPTY_ROWS, 'p1', 'fix the bug')
  rows = noteText(rows, 'p2', 'write tests')
  rows = noteText(rows, 'p3', 'fix the bug')

  assert.equal(resolveRow(rows, 'unknown', 'fix  the bug', ['p1', 'p2', 'p3']), 'p3')
  assert.equal(resolveRow(rows, 'unknown', 'something else', ['p1', 'p2', 'p3']), undefined)
})

test('resolveRow matches a drawn text that the host shortened or extended', () => {
  const rows = noteText(EMPTY_ROWS, 'm1', 'Here is the plan. First, read the file.')

  assert.equal(resolveRow(rows, 'r', 'Here is the plan.', ['m1']), 'm1')
})

test('pendingPrompt picks the unaliased prompt with the same text, else the latest unaliased', () => {
  let ledger = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  ledger = submitPrompt(ledger, 'p2', 10)
  let rows = noteText(EMPTY_ROWS, 'p1', 'first')
  rows = noteText(rows, 'p2', 'second')

  assert.equal(pendingPrompt(ledger, rows, 'first'), 'p1')
  assert.equal(pendingPrompt(ledger, rows, 'no match'), 'p2')
  assert.equal(pendingPrompt(ledger, aliasRow(rows, 'r2', 'p2'), 'no match'), 'p1')
})

test('pendingMessageMark takes the current turn message marks in order', () => {
  let ledger = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  ledger = startStep(ledger, 's1', 0, 'm')
  ledger = addMark(ledger, 'old', 'message', 1)
  ledger = submitPrompt(ledger, 'p2', 2)
  ledger = addMark(ledger, 'a', 'message', 3)
  ledger = addMark(ledger, 't', 'tool', 4)
  ledger = addMark(ledger, 'b', 'message', 5)

  assert.equal(pendingMessageMark(ledger, EMPTY_ROWS, ''), 'a')
  assert.equal(pendingMessageMark(ledger, aliasRow(EMPTY_ROWS, 'r', 'a'), ''), 'b')
  assert.equal(pendingMessageMark(ledger, noteText(EMPTY_ROWS, 'b', 'later text'), 'later text'), 'b')
  assert.deepEqual(markIds(ledger, 'message'), ['old', 'a', 'b'])
})

test('an empty drawn text matches nothing', () => {
  assert.equal(resolveRow(noteText(EMPTY_ROWS, 'm', 'x'), 'unknown', '', ['m']), undefined)
})
