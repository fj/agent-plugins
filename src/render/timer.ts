import type { Prompt } from '../core/ledger.ts'
import { formatClock, formatDuration } from './format.ts'

export type TimerView = { text: string; isLive: boolean }

export function timerView(startedAt: number, now: number, endedAt?: number): TimerView {
  const isLive = endedAt === undefined
  const elapsed = (endedAt ?? now) - startedAt

  return { text: `{${formatClock(startedAt)} Δ ${formatDuration(elapsed)}}`, isLive }
}

export function promptTimerView(prompt: Prompt, isCurrent: boolean, now: number): TimerView {
  if (prompt.firstReplyAt === undefined && !isCurrent) {
    return { text: `{${formatClock(prompt.submittedAt)}}`, isLive: false }
  }

  return timerView(prompt.submittedAt, now, prompt.firstReplyAt)
}
