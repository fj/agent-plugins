import { formatTokens } from './format.ts'
import { meterBar } from './meter.ts'
import { seg, type Line } from './segment.ts'

export type ContextFill = { tokens?: number; window: number }

const PERCENT = 100
const METER_WIDTH = 8

export function contextMeter({ tokens, window }: ContextFill): Line {
  const label = seg('ctx ', 'muted')
  const size = seg(formatTokens(window), 'input')

  if (tokens === undefined) {
    return [label, size]
  }

  return [
    label,
    seg(meterBar((tokens / window) * PERCENT, METER_WIDTH), 'meter'),
    seg(` ${formatTokens(tokens)}`, 'input'),
    seg(' / ', 'muted'),
    size,
  ]
}
