import { defaultUsageStrategy } from './default.ts'
import type { UsageStrategy } from './strategy.ts'

export type { UsageStrategy } from './strategy.ts'

export const USAGE_STRATEGIES: Readonly<Record<string, UsageStrategy>> = { default: defaultUsageStrategy }

export function usageStrategy(name: string | undefined): UsageStrategy {
  return USAGE_STRATEGIES[name ?? ''] ?? defaultUsageStrategy
}
