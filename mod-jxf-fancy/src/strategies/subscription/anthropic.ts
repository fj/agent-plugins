import type { QuotaMetadata, QuotaWindow } from '../../core/quota.ts'
import { meterBar } from '../../render/meter.ts'
import { seg, type Line } from '../../render/segment.ts'
import type { SubscriptionStrategy } from './strategy.ts'

const UTILIZATION_HEADER = /^anthropic-ratelimit-unified-([a-z0-9_]+)-utilization$/
const PERCENT = 100
const MS_PER_SECOND = 1000
const METER_WIDTH = 8

const LABELS: Readonly<Record<string, string>> = {
  five_hour: '5h',
  '5h': '5h',
  seven_day: '7d',
  '7d': '7d',
  seven_day_opus: '7d opus',
  '7d_opus': '7d opus',
  seven_day_sonnet: '7d sonnet',
  '7d_sonnet': '7d sonnet',
  spend_limit: 'spend',
}

function fromHeaders(headers: Readonly<Record<string, string>>): QuotaWindow[] {
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))

  return Object.entries(lower).flatMap(([name, value]) => {
    const kind = UTILIZATION_HEADER.exec(name)?.[1]
    const fraction = Number(value)

    if (kind === undefined || !Number.isFinite(fraction)) {
      return []
    }

    const reset = Number(lower[`anthropic-ratelimit-unified-${kind}-reset`])
    const resetsAt = Number.isFinite(reset) ? new Date(reset * MS_PER_SECOND).toISOString() : undefined

    return [{ kind, percentUsed: fraction * PERCENT, resetsAt }]
  })
}

function read(metadata: QuotaMetadata): readonly QuotaWindow[] | null {
  const windows = metadata.windows?.length ? metadata.windows : fromHeaders(metadata.headers ?? {})

  return windows.length > 0 ? windows : null
}

function render(windows: readonly QuotaWindow[]): Line {
  return windows.flatMap((window, i) => [
    ...(i === 0 ? [] : [seg('  ')]),
    seg(`${LABELS[window.kind] ?? window.kind} `, 'muted'),
    seg(meterBar(window.percentUsed, METER_WIDTH), 'meter'),
    seg(` ${Math.round(window.percentUsed)}%`, 'meter'),
  ])
}

export const anthropicSubscriptionStrategy: SubscriptionStrategy = { name: 'anthropic', read, render }
