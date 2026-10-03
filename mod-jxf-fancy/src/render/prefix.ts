import type { Mark, Step } from '../core/ledger.ts'
import type { UsageStrategy } from '../strategies/usage/strategy.ts'
import { formatClock, formatDuration } from './format.ts'
import { join, seg, type Line } from './segment.ts'

export type PrefixInput = { mark: Mark; step?: Step; now: number; usage: UsageStrategy }

const braced = (inner: Line): Line => (inner.length === 0 ? [] : [seg('{', 'muted'), ...inner, seg('}', 'muted')])

export function turnLabel(mark: Pick<Mark, 'turn' | 'seq'>): string {
  return `${mark.turn}.${mark.seq}`
}

export function messagePrefix({ mark, step, now, usage }: PrefixInput): Line {
  const startedAt = step?.startedAt ?? mark.startedAt
  const elapsed = (step?.endedAt ?? now) - startedAt
  const timing: Line = [seg(formatClock(startedAt), 'time'), seg(` Δ ${formatDuration(elapsed)}`, 'muted')]
  const tokens = step?.usage && step.totals ? [seg(': ', 'muted'), ...usage.stepTokens(step.usage, step.totals.usage)] : []
  const turn: Line = [seg(`turn ${turnLabel(mark)}`, 'label'), ...tokens]
  const cost = step?.cost && step.totals ? usage.stepCost(step.cost, step.totals.cost) : []

  return join([braced(timing), braced(turn), braced(cost)], seg(' '))
}
