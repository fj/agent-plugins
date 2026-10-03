import type { Totals } from '../core/totals.ts'
import { formatDuration, formatUsd, shortenPath } from './format.ts'
import { join, seg, type Line } from './segment.ts'
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

function block(label: string, totals: Totals, usage: UsageLines, extra: Line = []): Line {
  return [
    seg(`${label} `, 'muted'),
    seg(formatUsd(totals.cost), 'cost'),
    seg(' '),
    ...usage.totalTokens(totals.usage),
    seg(` ${formatDuration(totals.activeMs)}`, 'time'),
    ...(extra.length > 0 ? [seg(' '), ...extra] : []),
  ]
}

export function footerLine(input: FooterInput): Line {
  return join(
    [
      [seg(input.model, 'model')],
      [seg(shortenPath(input.cwd, input.home, input.maxPathWidth), 'path')],
      block('session', input.session, input.usage, input.quota),
      block('today', input.today, input.usage),
    ],
    seg(' · ', 'muted'),
  )
}
