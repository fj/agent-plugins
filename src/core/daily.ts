import { addTotals, sumTotals, ZERO_TOTALS, type Totals } from './totals.ts'

export type DayKey = string

export type SessionDays = Readonly<Record<DayKey, Totals>>

export type DailyStore = {
  write(day: DayKey, sessionKey: string, totals: Totals): Promise<void>
  readAll(day: DayKey): Promise<Totals[]>
}

const STATE_DIR = '.local/state/mod-jxf-fancy/days'

export function localDayKey(ms: number): DayKey {
  const date = new Date(ms)
  const pad = (n: number) => String(n).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function dayDir(home: string, day: DayKey): string {
  return `${home}/${STATE_DIR}/${day}`
}

export function sessionFile(home: string, day: DayKey, sessionKey: string): string {
  return `${dayDir(home, day)}/${sessionKey.replace(/[^A-Za-z0-9_.-]/g, '_')}.json`
}

export function addToDay(days: SessionDays, day: DayKey, delta: Totals): SessionDays {
  return { ...days, [day]: addTotals(days[day] ?? ZERO_TOTALS, delta) }
}

export function parseTotals(text: string): Totals | null {
  try {
    const value = JSON.parse(text) as Totals
    const isTotals =
      typeof value?.activeMs === 'number' &&
      typeof value.cost?.usd === 'number' &&
      typeof value.usage?.output === 'number'

    return isTotals ? value : null
  } catch {
    return null
  }
}

export { sumTotals }
