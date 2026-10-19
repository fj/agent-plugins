import type { Totals } from '../core/totals.ts'
import { contextMeter, type ContextFill } from './context.ts'
import { formatDuration, formatRemaining, formatUsd, shortenPath } from './format.ts'
import { join, seg, type Line } from './segment.ts'
import type { TokenDisplay, UsageLines } from './usage-lines.ts'

export type FooterLayout = { isTotalsCombined: boolean; showsSubscription: boolean; showsContext: boolean }

export type FooterInput = {
  model: string
  effort?: string
  cwd: string
  branch?: string
  home: string
  session: Totals
  today: Totals
  quota: Line
  context?: ContextFill
  cacheRemainingMs?: number
  usage: UsageLines
  display: TokenDisplay
  maxPathWidth: number
  layout: FooterLayout
}

const ZERO_DURATION = formatDuration(0)
const GROUP_GAP = seg('  ')
const BRANCH_SYMBOL = '\ue0a0'
const CACHE_SYMBOL = '\u231b'

function timeSegments(activeMs: number): Line {
  const duration = formatDuration(activeMs)

  return duration === ZERO_DURATION ? [] : [seg(duration, 'time'), seg(' · ', 'muted')]
}

function cacheSegments(remainingMs: number | undefined): Line {
  if (remainingMs === undefined) {
    return []
  }

  return [seg(` ${CACHE_SYMBOL}`, 'muted'), seg(formatRemaining(remainingMs), remainingMs > 0 ? 'cache' : 'muted')]
}

function totalsLine(label: string, totals: Totals, { usage, display }: FooterInput, suffix: Line = []): Line {
  return [
    seg(`${label} `, 'muted'),
    ...timeSegments(totals.activeMs),
    seg(formatUsd(totals.cost), 'cost'),
    seg(' '),
    ...usage.totalTokens(totals.usage, display),
    ...suffix,
  ]
}

function totalsLines(input: FooterInput): Line[] {
  const lines = [
    totalsLine('session', input.session, input, cacheSegments(input.cacheRemainingMs)),
    totalsLine('today', input.today, input),
  ]

  return input.layout.isTotalsCombined ? [join(lines, GROUP_GAP)] : lines
}

function metersLine({ quota, context, layout }: FooterInput): Line {
  const shownQuota = layout.showsSubscription ? quota : []
  const shownContext = layout.showsContext && context !== undefined ? contextMeter(context) : []

  return join([shownQuota, shownContext], GROUP_GAP)
}

function branchSegments(branch: string | undefined): Line {
  return branch === undefined ? [] : [seg(' · ', 'muted'), seg(`${BRANCH_SYMBOL} ${branch}`, 'branch')]
}

function effortSegments(effort: string | undefined): Line {
  return effort === undefined ? [] : [seg(` (${effort})`, 'muted')]
}

export function footerHead(input: FooterInput): Line {
  return [
    seg(input.model, 'model'),
    ...effortSegments(input.effort),
    seg(' · ', 'muted'),
    seg(shortenPath(input.cwd, input.home, input.maxPathWidth), 'path'),
    ...branchSegments(input.branch),
  ]
}

export function footerRows(input: FooterInput): Line[] {
  const meters = metersLine(input)

  return [...totalsLines(input), ...(meters.length > 0 ? [meters] : [])]
}

export function footer(input: FooterInput): Line[] {
  return [footerHead(input), ...footerRows(input)]
}
