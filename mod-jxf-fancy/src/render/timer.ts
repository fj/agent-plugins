import { formatClock, formatDuration } from './format.ts'

export type TimerView = { text: string; isLive: boolean }

export function timerView(startedAt: number, now: number, endedAt?: number): TimerView {
  const isLive = endedAt === undefined
  const elapsed = (endedAt ?? now) - startedAt

  return { text: `{${formatClock(startedAt)} Δ ${formatDuration(elapsed)}}`, isLive }
}
