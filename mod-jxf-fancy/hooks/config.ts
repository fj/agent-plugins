import type { PluginOptions } from 'claude-code'

import { subscriptionStrategy, type SubscriptionStrategy } from '../src/strategies/subscription/index.ts'
import { usageStrategy, type UsageStrategy } from '../src/strategies/usage/index.ts'

export type Config = { usage: UsageStrategy; subscription: SubscriptionStrategy; isDebug: boolean }

export function configFrom(options: PluginOptions): Config {
  return {
    usage: usageStrategy(String(options.usageStrategy)),
    subscription: subscriptionStrategy(String(options.subscriptionStrategy)),
    isDebug: options.debug === true,
  }
}
