import type { Mark, Step } from '../core/ledger.ts'
import { formatClock, formatDuration } from './format.ts'
import { join, seg, type Line } from './segment.ts'
import type { TokenDisplay, UsageLines } from './usage-lines.ts'

export type PrefixInput = { mark: Mark; step?: Step; now: number; usage: UsageLines; display: TokenDisplay }

const braced = (inner: Line): Line => (inner.length === 0 ? [] : [seg('{', 'muted'), ...inner, seg('}', 'muted')])

export function turnTag(mark: Pick<Mark, 'turn' | 'seq'>, tokens: Line = []): Line {
  return braced([seg(`turn ${mark.turn}.${mark.seq}`, 'label'), ...tokens])
}

export function messageTags({ mark, step, usage, display }: Omit<PrefixInput, 'now'>): Line {
  const tokens =
    step?.usage && step.totals ? [seg(': ', 'muted'), ...usage.stepTokens(step.usage, step.totals.usage, display)] : []
  const cost = step?.cost && step.totals ? usage.stepCost(step.cost, step.totals.cost) : []

  return join([turnTag(mark, tokens), braced(cost)], seg(' '))
}

export function messagePrefix(input: PrefixInput): Line {
  const { mark, step, now } = input
  const startedAt = step?.startedAt ?? mark.startedAt
  const elapsed = (step?.endedAt ?? now) - startedAt
  const timing: Line = [seg(formatClock(startedAt), 'time'), seg(` Δ ${formatDuration(elapsed)}`, 'muted')]

  return join([braced(timing), messageTags(input)], seg(' '))
}
