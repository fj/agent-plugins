import assert from 'node:assert/strict'
import { test } from 'node:test'

import { localDayKey } from '../src/core/daily.ts'
import { applyRecord, EMPTY_JOURNAL, foldJournal, isJournalRecord, type JournalRecord } from '../src/core/journal.ts'
import { defaultUsageStrategy } from '../src/strategies/usage/default.ts'

const T0 = new Date(2026, 9, 3, 23, 59, 50).getTime()
const NEXT_DAY = new Date(2026, 9, 4, 0, 0, 5).getTime()
const USAGE = { input: 10, cacheRead: 1000, cacheWrite: 90, output: 50 }
const price = defaultUsageStrategy.price

const RUN: JournalRecord[] = [
  { kind: 'prompt', id: 'p1', at: T0 },
  { kind: 'step', id: 's1', at: T0 + 1000, model: 'claude-opus-5-5' },
  { kind: 'message', id: 's1', at: T0 + 1000 },
  { kind: 'tool', id: 't1', at: T0 + 2000 },
  { kind: 'stepEnd', id: 's1', at: T0 + 2500, usage: USAGE },
  { kind: 'toolEnd', id: 't1', at: T0 + 3000 },
  { kind: 'step', id: 's2', at: NEXT_DAY, model: 'claude-opus-5-5' },
  { kind: 'message', id: 's2', at: NEXT_DAY },
  { kind: 'stepEnd', id: 's2', at: NEXT_DAY + 100, usage: USAGE },
  { kind: 'turnEnd', at: NEXT_DAY + 200 },
]

test('replaying a run numbers messages and tools, and records the first reply', () => {
  const { ledger } = foldJournal(RUN, price)

  assert.equal(ledger.prompts.p1?.firstReplyAt, T0 + 1000)
  assert.deepEqual(
    ['s1', 't1', 's2'].map(id => [ledger.marks[id]?.kind, ledger.marks[id]?.seq]),
    [['message', 1], ['tool', 2], ['message', 3]],
  )
  assert.equal(ledger.marks.t1?.endedAt, T0 + 3000)
  assert.equal(ledger.marks.t1?.stepId, 's1')
  assert.equal(ledger.steps.s1?.endedAt, T0 + 2500)
  assert.equal(ledger.marks.s1?.endedAt, T0 + 2500)
  assert.equal(ledger.currentPromptId, undefined)
})

test('replaying splits usage and active time by the local day of each record', () => {
  const { ledger, days } = foldJournal(RUN, price)
  const first = days[localDayKey(T0)]
  const second = days[localDayKey(NEXT_DAY)]

  assert.equal(first?.usage.output, USAGE.output)
  assert.equal(first?.activeMs, 0)
  assert.equal(second?.activeMs, NEXT_DAY + 200 - T0)
  assert.ok((first?.cost.usd ?? 0) > 0)
  assert.equal(ledger.totals.usage.output, 2 * USAGE.output)
  assert.equal(ledger.totals.activeMs, NEXT_DAY + 200 - T0)
})

test('a step can hold several message blocks, numbered in order and ended with the step', () => {
  const { ledger } = foldJournal(
    [
      { kind: 'prompt', id: 'p', at: T0 },
      { kind: 'step', id: 's', at: T0, model: 'claude-opus-5-5' },
      { kind: 'message', id: 's:0', at: T0 + 100 },
      { kind: 'message', id: 's:1', at: T0 + 200 },
      { kind: 'stepEnd', id: 's', at: T0 + 300, usage: USAGE },
      { kind: 'tool', id: 't', at: T0 + 400 },
    ],
    price,
  )

  assert.deepEqual(
    ['s:0', 's:1', 't'].map(id => [ledger.marks[id]?.seq, ledger.marks[id]?.stepId, ledger.marks[id]?.endedAt]),
    [
      [1, 's', T0 + 300],
      [2, 's', T0 + 300],
      [3, 's', undefined],
    ],
  )
  assert.equal(ledger.prompts.p?.firstReplyAt, T0 + 100)
})

test('a step that ends without a message block still counts as the first reply', () => {
  const { ledger } = foldJournal(
    [
      { kind: 'prompt', id: 'p', at: T0 },
      { kind: 'step', id: 's', at: T0 + 100, model: 'claude-opus-5-5' },
      { kind: 'stepEnd', id: 's', at: T0 + 900, usage: USAGE },
    ],
    price,
  )

  assert.equal(ledger.prompts.p?.firstReplyAt, T0 + 900)
  assert.equal(ledger.seq, 0)
})

test('an unknown model prices as a lower bound', () => {
  const journal = foldJournal(
    [
      { kind: 'prompt', id: 'p', at: T0 },
      { kind: 'step', id: 's', at: T0, model: 'gpt-9' },
      { kind: 'stepEnd', id: 's', at: T0, usage: USAGE },
    ],
    price,
  )

  assert.equal(journal.days[localDayKey(T0)]?.cost.isLowerBound, true)
})

test('applying records one at a time matches folding them', () => {
  const stepwise = RUN.reduce((journal, record) => applyRecord(journal, record, price), EMPTY_JOURNAL)

  assert.deepEqual(stepwise, foldJournal(RUN, price))
})

test('only well-formed records are recognized', () => {
  assert.ok(isJournalRecord({ kind: 'turnEnd', at: 1 }))
  assert.equal(isJournalRecord({ kind: 'nope', at: 1 }), false)
  assert.equal(isJournalRecord({ kind: 'prompt' }), false)
  assert.equal(isJournalRecord(undefined), false)
})
