import { dayDir, parseTotals, sessionFile, sumTotals, type DailyStore, type DayKey } from '../src/core/daily.ts'
import type { Totals } from '../src/core/totals.ts'

const SESSION_KEY_PREFIX = 'claude-code-'
const TOTALS_SUFFIX = '.json'

export type FileEntry = { name: string; kind: string }

export type Files = {
  write(path: string, text: string): Promise<void>
  list(path: string): Promise<readonly FileEntry[]>
  read(path: string): Promise<string>
}

export function sessionKeyFor(sessionId: string): string {
  return `${SESSION_KEY_PREFIX}${sessionId}`
}

export function fileDailyStore(files: Files, home: string): DailyStore {
  return {
    async write(day: DayKey, key: string, totals: Totals) {
      await files.write(sessionFile(home, day, key), JSON.stringify(totals))
    },
    async readAll(day: DayKey) {
      const dir = dayDir(home, day)
      const entries = await files.list(dir).catch(() => [])
      const names = entries.filter(entry => entry.kind === 'file' && entry.name.endsWith(TOTALS_SUFFIX))
      const texts = await Promise.all(names.map(entry => files.read(`${dir}/${entry.name}`).catch(() => '')))

      return texts.map(parseTotals).filter((totals): totals is Totals => totals !== null)
    },
  }
}

export async function readToday(store: DailyStore, day: DayKey): Promise<Totals> {
  return sumTotals(await store.readAll(day))
}
