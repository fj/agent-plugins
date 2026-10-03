import type { Totals } from '../core/totals.ts'
import { formatDuration, formatUsd, shortenPath } from './format.ts'
import { seg, type Line } from './segment.ts'
import type { UsageLines } from './usage-lines.ts'

export type FooterInput = {
  model: string
  cwd: string
  home: string
  session: Totals
  today: Totals
  quota: Line
  usage: UsageLines
  maxPathWidth: number
}

function totalsLine(label: string, totals: Totals, usage: UsageLines): Line {
  return [
    seg(`${label} `, 'muted'),
    seg(formatDuration(totals.activeMs), 'time'),
    seg(' · ', 'muted'),
    seg(formatUsd(totals.cost), 'cost'),
    seg(' '),
    ...usage.totalTokens(totals.usage),
  ]
}

export function footer(input: FooterInput): Line[] {
  const lines = [
    [
      seg(input.model, 'model'),
      seg(' · ', 'muted'),
      seg(shortenPath(input.cwd, input.home, input.maxPathWidth), 'path'),
    ],
    totalsLine('session', input.session, input.usage),
    totalsLine('today', input.today, input.usage),
  ]

  return input.quota.length > 0 ? [...lines, input.quota] : lines
}
