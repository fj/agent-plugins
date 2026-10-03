import { localDayKey, type DailyStore, type DayKey } from './daily.ts'
import { applyRecord, EMPTY_JOURNAL, foldJournal, type Journal, type JournalRecord } from './journal.ts'
import type { LedgerState, Pricer } from './ledger.ts'
import { addTotals, sumTotals, ZERO_TOTALS, type Totals } from './totals.ts'

export type SessionTracker = {
  ledger(): LedgerState
  record(record: JournalRecord): void
  replay(branch: readonly JournalRecord[], all: readonly JournalRecord[]): void
  today(now: number): Totals
  refreshOthers(now: number): Promise<void>
}

export type TrackerOptions = { store: DailyStore; sessionKey: string; price: Pricer }

const PERSISTED_KINDS = new Set<JournalRecord['kind']>(['stepEnd', 'turnEnd'])

export function sessionTracker({ store, sessionKey, price }: TrackerOptions): SessionTracker {
  let branch: Journal = EMPTY_JOURNAL
  let all: Journal = EMPTY_JOURNAL
  let others: { day: DayKey; totals: Totals } = { day: '', totals: ZERO_TOTALS }

  function persistDay(at: number) {
    const day = localDayKey(at)
    const totals = all.days[day]

    if (totals !== undefined) {
      void store.write(day, sessionKey, totals).catch(() => undefined)
    }
  }

  return {
    ledger: () => branch.ledger,

    record(record) {
      branch = applyRecord(branch, record, price)
      all = applyRecord(all, record, price)

      if (PERSISTED_KINDS.has(record.kind)) {
        persistDay(record.at)
      }
    },

    replay(branchRecords, allRecords) {
      branch = foldJournal(branchRecords, price)
      all = foldJournal(allRecords, price)
    },

    today(now) {
      const day = localDayKey(now)
      const own = all.days[day] ?? ZERO_TOTALS

      return others.day === day ? addTotals(others.totals, own) : own
    },

    async refreshOthers(now) {
      const day = localDayKey(now)

      others = { day, totals: sumTotals(await store.readAll(day, sessionKey)) }
    },
  }
}
