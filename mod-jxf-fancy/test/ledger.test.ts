import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  addMark,
  completeStep,
  completeTurn,
  EMPTY_LEDGER,
  endMark,
  markStep,
  startStep,
  submitPrompt,
} from '../src/core/ledger.ts'
import { defaultUsageStrategy } from '../src/strategies/usage/default.ts'

const USAGE = { input: 10, cacheRead: 1000, cacheWrite: 90, output: 50 }
const price = defaultUsageStrategy.price

test('numbers segments X.Y per prompt and resets Y on the next prompt', () => {
  let s = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  s = startStep(s, 's1', 10, 'claude-opus-5-5')
  s = addMark(s, 'm1', 'message', 20)
  s = addMark(s, 't1', 'tool', 30)
  s = submitPrompt(s, 'p2', 40)
  s = addMark(s, 'm2', 'message', 50)

  assert.deepEqual([s.marks.m1?.turn, s.marks.m1?.seq], [1, 1])
  assert.deepEqual([s.marks.t1?.turn, s.marks.t1?.seq], [1, 2])
  assert.deepEqual([s.marks.m2?.turn, s.marks.m2?.seq], [2, 1])
})

test('adding the same mark twice keeps the first', () => {
  let s = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  s = addMark(s, 'm1', 'message', 20)
  s = addMark(s, 'm1', 'message', 99)

  assert.equal(s.seq, 1)
  assert.equal(s.marks.m1?.startedAt, 20)
})

test('the first mark after a prompt records the first reply time once', () => {
  let s = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  s = addMark(s, 'm1', 'message', 20)
  s = addMark(s, 'm2', 'message', 30)

  assert.equal(s.prompts.p1?.firstReplyAt, 20)
})

test('completing a step prices it and snapshots the session totals', () => {
  let s = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  s = startStep(s, 's1', 10, 'claude-opus-5-5')
  s = addMark(s, 'm1', 'message', 20)
  s = completeStep(s, 's1', USAGE, 100, price)
  s = startStep(s, 's2', 110, 'claude-opus-5-5')
  s = completeStep(s, 's2', USAGE, 200, price)

  assert.equal(markStep(s, 'm1')?.id, 's1')
  assert.equal(s.steps.s1?.totals?.usage.output, 50)
  assert.equal(s.steps.s2?.totals?.usage.output, 100)
  assert.equal(s.totals.usage.cacheRead, 2000)
  assert.ok((s.steps.s1?.cost?.usd ?? 0) > 0)
})

test('completing an unknown step changes nothing', () => {
  const s = submitPrompt(EMPTY_LEDGER, 'p1', 0)

  assert.equal(completeStep(s, 'nope', USAGE, 1, price), s)
})

test('completing a turn adds the time since the prompt as active time', () => {
  const s = submitPrompt(EMPTY_LEDGER, 'p1', 1000)
  const { state, delta } = completeTurn(s, 4500)

  assert.equal(delta.activeMs, 3500)
  assert.equal(state.totals.activeMs, 3500)
  assert.equal(state.currentPromptId, undefined)
})

test('ending a mark sets its end time', () => {
  let s = submitPrompt(EMPTY_LEDGER, 'p1', 0)
  s = addMark(s, 't1', 'tool', 10)
  s = endMark(s, 't1', 25)

  assert.equal(s.marks.t1?.endedAt, 25)
  assert.equal(endMark(s, 'missing', 1), s)
})
