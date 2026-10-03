import assert from 'node:assert/strict'
import { test } from 'node:test'

import { localDayKey, type DailyStore } from '../src/core/daily.ts'
import type { JournalRecord } from '../src/core/journal.ts'
import { ZERO_TOTALS, type Totals } from '../src/core/totals.ts'
import { persistDay, sessionTracker } from '../src/core/tracker.ts'
import { defaultUsageStrategy } from '../src/strategies/usage/default.ts'

const T0 = new Date(2026, 9, 3, 23, 59, 0).getTime()
const NEXT_DAY = new Date(2026, 9, 4, 0, 1, 0).getTime()
const USAGE = { input: 10, cacheRead: 1000, cacheWrite: 90, output: 50 }
const OTHER_USD = 10

function recordingStore(options: { failWrites?: boolean } = {}) {
  const writes: { day: string; key: string; totals: Totals }[] = []
  const reads: { day: string; except?: string }[] = []
  const store: DailyStore = {
    write: async (day, key, totals) => {
      writes.push({ day, key, totals })

      if (options.failWrites) {
        throw new Error('disk full')
      }
    },
    readAll: async (day, except) => {
      reads.push({ day, except })

      return [{ ...ZERO_TOTALS, cost: { usd: OTHER_USD, isLowerBound: false } }]
    },
  }

  return { store, writes, reads }
}

const RUN: JournalRecord[] = [
  { kind: 'prompt', id: 'p', at: T0 },
  { kind: 'step', id: 's', at: T0 + 100, model: 'claude-opus-5-5' },
  { kind: 'message', id: 's', at: T0 + 100 },
  { kind: 'tool', id: 't', at: T0 + 200 },
  { kind: 'toolEnd', id: 't', at: T0 + 300 },
  { kind: 'stepEnd', id: 's', at: T0 + 400, usage: USAGE },
  { kind: 'turnEnd', at: T0 + 500 },
]

const track = (store: DailyStore) => sessionTracker({ store, sessionKey: 'pi-a', price: defaultUsageStrategy.price })

test('the tracker writes its own day file when a step or turn ends, and only then', () => {
  const { store, writes } = recordingStore()
  const tracker = track(store)

  RUN.forEach(record => tracker.record(record))

  assert.deepEqual(
    writes.map(w => [w.day, w.key, w.totals.usage.output, w.totals.activeMs]),
    [
      [localDayKey(T0), 'pi-a', USAGE.output, 0],
      [localDayKey(T0), 'pi-a', USAGE.output, 500],
    ],
  )
  assert.equal(tracker.ledger().marks.t?.endedAt, T0 + 300)
})

test('today adds other sessions to this one, skipping this session when reading', async () => {
  const { store, reads } = recordingStore()
  const tracker = track(store)

  RUN.forEach(record => tracker.record(record))
  await tracker.refreshOthers(T0)

  const today = tracker.today(T0)

  assert.deepEqual(reads, [{ day: localDayKey(T0), except: 'pi-a' }])
  assert.equal(today.cost.usd, OTHER_USD + (tracker.ledger().totals.cost.usd))
  assert.equal(today.usage.output, USAGE.output)
})

test('after midnight, today drops the stale other-session totals and yesterday', async () => {
  const { store } = recordingStore()
  const tracker = track(store)

  RUN.forEach(record => tracker.record(record))
  await tracker.refreshOthers(T0)

  assert.deepEqual(tracker.today(NEXT_DAY), ZERO_TOTALS)
})

test('replay keeps the branch for the ledger and every entry for the day totals', () => {
  const { store } = recordingStore()
  const tracker = track(store)
  const abandoned: JournalRecord[] = [
    { kind: 'step', id: 'x', at: T0, model: 'claude-opus-5-5' },
    { kind: 'stepEnd', id: 'x', at: T0, usage: USAGE },
  ]

  tracker.replay(RUN, [...abandoned, ...RUN])

  assert.equal(tracker.ledger().totals.usage.output, USAGE.output)
  assert.equal(tracker.today(T0).usage.output, 2 * USAGE.output)
})

test('a failed write does not throw or reject unhandled', async () => {
  const { store, writes } = recordingStore({ failWrites: true })
  const tracker = track(store)

  assert.doesNotThrow(() => RUN.forEach(record => tracker.record(record)))
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(writes.length, 2)
})

test('persisting a day swallows a write that throws before it returns a promise', async () => {
  const store: DailyStore = {
    write: () => {
      throw new Error('no disk')
    },
    readAll: async () => [],
  }

  await persistDay(store, 'pi-a', { [localDayKey(T0)]: ZERO_TOTALS }, T0)
})
