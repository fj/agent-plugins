import { anthropicSubscriptionStrategy } from './anthropic.ts'
import { nullSubscriptionStrategy } from './null.ts'
import type { SubscriptionStrategy } from './strategy.ts'

export type { SubscriptionStrategy } from './strategy.ts'

export const SUBSCRIPTION_STRATEGIES: Readonly<Record<string, SubscriptionStrategy>> = {
  anthropic: anthropicSubscriptionStrategy,
  null: nullSubscriptionStrategy,
}

export function subscriptionStrategy(name: string | undefined): SubscriptionStrategy {
  return SUBSCRIPTION_STRATEGIES[name ?? ''] ?? nullSubscriptionStrategy
}
