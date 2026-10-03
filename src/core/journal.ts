import { addToDay, localDayKey, type SessionDays } from './daily.ts'
import {
  addMark,
  completeTurn,
  EMPTY_LEDGER,
  endMark,
  finishStep,
  startStep,
  submitPrompt,
  type LedgerState,
  type Pricer,
} from './ledger.ts'
import { ZERO_COST } from './cost.ts'
import type { TokenUsage } from './usage.ts'

export type JournalRecord =
  | { kind: 'prompt'; id: string; at: number }
  | { kind: 'step'; id: string; at: number; model: string }
  | { kind: 'message'; id: string; at: number }
  | { kind: 'stepEnd'; id: string; at: number; usage: TokenUsage }
  | { kind: 'tool'; id: string; at: number }
  | { kind: 'toolEnd'; id: string; at: number }
  | { kind: 'turnEnd'; at: number }

export type Journal = { ledger: LedgerState; days: SessionDays }

export const EMPTY_JOURNAL: Journal = { ledger: EMPTY_LEDGER, days: {} }

const RECORD_KINDS = new Set(['prompt', 'step', 'message', 'stepEnd', 'tool', 'toolEnd', 'turnEnd'])

export function isJournalRecord(value: unknown): value is JournalRecord {
  const record = value as JournalRecord | undefined

  return typeof record?.at === 'number' && RECORD_KINDS.has(record.kind)
}

export function applyRecord({ ledger, days }: Journal, record: JournalRecord, price: Pricer): Journal {
  switch (record.kind) {
    case 'prompt':
      return { ledger: submitPrompt(ledger, record.id, record.at), days }
    case 'step':
      return { ledger: startStep(ledger, record.id, record.at, record.model), days }
    case 'message':
      return { ledger: addMark(ledger, record.id, 'message', record.at), days }
    case 'stepEnd': {
      const next = finishStep(ledger, record.id, record.usage, record.at, price)
      const cost = next.steps[record.id]?.cost ?? ZERO_COST

      return { ledger: next, days: addToDay(days, localDayKey(record.at), { usage: record.usage, cost, activeMs: 0 }) }
    }
    case 'tool':
      return { ledger: addMark(ledger, record.id, 'tool', record.at), days }
    case 'toolEnd':
      return { ledger: endMark(ledger, record.id, record.at), days }
    case 'turnEnd': {
      const { state, delta } = completeTurn(ledger, record.at)

      return { ledger: state, days: addToDay(days, localDayKey(record.at), delta) }
    }
  }
}

export function foldJournal(records: readonly JournalRecord[], price: Pricer): Journal {
  return records.reduce((journal, record) => applyRecord(journal, record, price), EMPTY_JOURNAL)
}
