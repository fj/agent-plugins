import type { Totals } from '../core/totals.ts'
import { contextMeter, type ContextFill } from './context.ts'
import { formatDuration, formatUsd, shortenPath } from './format.ts'
import { join, seg, type Line } from './segment.ts'
import type { UsageLines } from './usage-lines.ts'

export type FooterLayout = { isTotalsCombined: boolean; showsSubscription: boolean; showsContext: boolean }

export type FooterInput = {
  model: string
  cwd: string
  home: string
  session: Totals
  today: Totals
  quota: Line
  context?: ContextFill
  usage: UsageLines
  maxPathWidth: number
  layout: FooterLayout
}

const ZERO_DURATION = formatDuration(0)
const GROUP_GAP = seg('  ')

function timeSegments(activeMs: number): Line {
  const duration = formatDuration(activeMs)

  return duration === ZERO_DURATION ? [] : [seg(duration, 'time'), seg(' · ', 'muted')]
}

function totalsLine(label: string, totals: Totals, usage: UsageLines): Line {
  return [
    seg(`${label} `, 'muted'),
    ...timeSegments(totals.activeMs),
    seg(formatUsd(totals.cost), 'cost'),
    seg(' '),
    ...usage.totalTokens(totals.usage),
  ]
}

function totalsLines(input: FooterInput): Line[] {
  const lines = [totalsLine('session', input.session, input.usage), totalsLine('today', input.today, input.usage)]

  return input.layout.isTotalsCombined ? [join(lines, GROUP_GAP)] : lines
}

function metersLine({ quota, context, layout }: FooterInput): Line {
  const shownQuota = layout.showsSubscription ? quota : []
  const shownContext = layout.showsContext && context !== undefined ? contextMeter(context) : []

  return join([shownQuota, shownContext], GROUP_GAP)
}

export function footer(input: FooterInput): Line[] {
  const head = [
    seg(input.model, 'model'),
    seg(' · ', 'muted'),
    seg(shortenPath(input.cwd, input.home, input.maxPathWidth), 'path'),
  ]
  const meters = metersLine(input)

  return [head, ...totalsLines(input), ...(meters.length > 0 ? [meters] : [])]
}
