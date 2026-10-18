import type { QuotaMetadata, QuotaReading, QuotaWindow } from '../../core/quota.ts'
import { meterBar } from '../../render/meter.ts'
import { seg, type Line } from '../../render/segment.ts'
import type { SubscriptionStrategy } from './strategy.ts'

const UTILIZATION_HEADER = /^anthropic-ratelimit-unified-([a-z0-9_]+)-utilization$/
const PERCENT = 100
const MS_PER_SECOND = 1000
const METER_WIDTH = 8
const REJECTED = 'rejected'
const SERVING_OVERAGE = new Set(['allowed', 'allowed_warning'])
const PLAN_WINDOWS = new Set(['five_hour', '5h', 'seven_day', '7d'])

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

const lowerCased = (headers: Readonly<Record<string, string>>) =>
  Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))

const isPlanWindow = (window: QuotaWindow) => PLAN_WINDOWS.has(window.kind)

const isFull = (window: QuotaWindow) => window.percentUsed >= PERCENT

function fromHeaders(headers: Readonly<Record<string, string>>): QuotaWindow[] {
  const lower = lowerCased(headers)

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

function isServedByOverage(headers: Readonly<Record<string, string>>): boolean {
  const lower = lowerCased(headers)

  return (
    lower['anthropic-ratelimit-unified-status'] === REJECTED &&
    SERVING_OVERAGE.has(lower['anthropic-ratelimit-unified-overage-status'] ?? '')
  )
}

function read(metadata: QuotaMetadata): QuotaReading | null {
  const reported = metadata.windows ?? []
  const windows = reported.length > 0 ? reported : fromHeaders(metadata.headers ?? {})

  if (windows.length === 0) {
    return null
  }

  const isUsingOverage =
    reported.length > 0 ? reported.some(window => isPlanWindow(window) && isFull(window)) : isServedByOverage(metadata.headers ?? {})

  return { windows, isUsingOverage }
}

function render(reading: QuotaReading): Line {
  return reading.windows.flatMap((window, i) => [
    ...(i === 0 ? [] : [seg('  ')]),
    seg(`${LABELS[window.kind] ?? window.kind} `, 'muted'),
    seg(meterBar(window.percentUsed, METER_WIDTH), 'meter'),
    seg(` ${Math.round(window.percentUsed)}%`, 'meter'),
  ])
}

export const anthropicSubscriptionStrategy: SubscriptionStrategy = { name: 'anthropic', read, render }
