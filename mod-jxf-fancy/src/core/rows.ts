import type { LedgerState, MarkKind } from './ledger.ts'

export type RowIndex = {
  aliases: Readonly<Record<string, string>>
  texts: Readonly<Record<string, string>>
}

export const EMPTY_ROWS: RowIndex = { aliases: {}, texts: {} }

const TEXT_KEY_LENGTH = 120

function textKey(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, TEXT_KEY_LENGTH)
}

export function appendKeyText(seen: string, chunk: string): string {
  return seen.length < TEXT_KEY_LENGTH ? seen + chunk : seen
}

export function noteText(rows: RowIndex, ledgerId: string, text: string): RowIndex {
  return { ...rows, texts: { ...rows.texts, [ledgerId]: textKey(text) } }
}

export function aliasRow(rows: RowIndex, rowId: string, ledgerId: string): RowIndex {
  return { ...rows, aliases: { ...rows.aliases, [rowId]: ledgerId } }
}

function isAliased(rows: RowIndex, ledgerId: string): boolean {
  return Object.values(rows.aliases).includes(ledgerId)
}

function keysMatch(a: string, b: string): boolean {
  return a !== '' && b !== '' && (a.startsWith(b) || b.startsWith(a))
}

function latestByText(rows: RowIndex, ids: readonly string[], text: string): string | undefined {
  const key = textKey(text)

  return [...ids].reverse().find(id => keysMatch(rows.texts[id] ?? '', key))
}

export function resolveRow(rows: RowIndex, rowId: string, text: string, ids: readonly string[]): string | undefined {
  return rows.aliases[rowId] ?? latestByText(rows, ids, text)
}

export function promptIds(ledger: LedgerState): string[] {
  return Object.values(ledger.prompts)
    .sort((a, b) => a.turn - b.turn)
    .map(prompt => prompt.id)
}

export function markIds(ledger: LedgerState, kind: MarkKind): string[] {
  return Object.values(ledger.marks)
    .filter(mark => mark.kind === kind)
    .sort((a, b) => a.turn - b.turn || a.seq - b.seq)
    .map(mark => mark.id)
}

export function pendingPrompt(ledger: LedgerState, rows: RowIndex, text: string): string | undefined {
  const open = promptIds(ledger).filter(id => !isAliased(rows, id))

  return latestByText(rows, open, text) ?? open.at(-1)
}

export function pendingMessageMark(ledger: LedgerState, rows: RowIndex, text: string): string | undefined {
  const open = markIds(ledger, 'message').filter(id => ledger.marks[id]?.turn === ledger.turn && !isAliased(rows, id))
  const byText = open.find(id => keysMatch(rows.texts[id] ?? '', textKey(text)))

  return byText ?? open[0]
}
