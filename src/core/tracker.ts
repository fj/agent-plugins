import { localDayKey, type DailyStore, type DayKey, type SessionDays } from './daily.ts'
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

export type OtherSessions = { day: DayKey; totals: Totals }

export const NO_OTHER_SESSIONS: OtherSessions = { day: '', totals: ZERO_TOTALS }

const PERSISTED_KINDS = new Set<JournalRecord['kind']>(['stepEnd', 'turnEnd'])

export function isPersistedRecord(record: JournalRecord): boolean {
  return PERSISTED_KINDS.has(record.kind)
}

export async function persistDay(store: DailyStore, sessionKey: string, days: SessionDays, at: number): Promise<void> {
  const day = localDayKey(at)
  const totals = days[day]

  if (totals === undefined) {
    return
  }

  try {
    await store.write(day, sessionKey, totals)
  } catch {
    // A lost write only delays other sessions' view of today until the next one.
  }
}

export async function readOtherSessions(store: DailyStore, sessionKey: string, now: number): Promise<OtherSessions> {
  const day = localDayKey(now)

  return { day, totals: sumTotals(await store.readAll(day, sessionKey)) }
}

export function todayTotals(days: SessionDays, others: OtherSessions, now: number): Totals {
  const day = localDayKey(now)
  const own = days[day] ?? ZERO_TOTALS

  return others.day === day ? addTotals(others.totals, own) : own
}

export function sessionTracker({ store, sessionKey, price }: TrackerOptions): SessionTracker {
  let branch: Journal = EMPTY_JOURNAL
  let all: Journal = EMPTY_JOURNAL
  let others = NO_OTHER_SESSIONS

  return {
    ledger: () => branch.ledger,

    record(record) {
      branch = applyRecord(branch, record, price)
      all = applyRecord(all, record, price)

      if (isPersistedRecord(record)) {
        void persistDay(store, sessionKey, all.days, record.at)
      }
    },

    replay(branchRecords, allRecords) {
      branch = foldJournal(branchRecords, price)
      all = foldJournal(allRecords, price)
    },

    today: now => todayTotals(all.days, others, now),

    async refreshOthers(now) {
      others = await readOtherSessions(store, sessionKey, now)
    },
  }
}
