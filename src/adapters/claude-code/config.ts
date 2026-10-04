import type { PluginOptions } from 'claude-code'

import { footerLayout, parseFooterConfig } from '../../config/config.ts'
import type { FooterLayout } from '../../render/footer.ts'
import { subscriptionStrategy, type SubscriptionStrategy } from '../../strategies/subscription/index.ts'
import { usageStrategy, type UsageStrategy } from '../../strategies/usage/index.ts'

export type Config = { usage: UsageStrategy; subscription: SubscriptionStrategy; footer: FooterLayout; isDebug: boolean }

export function configFrom(options: PluginOptions): Config {
  return {
    usage: usageStrategy(String(options.usageStrategy)),
    subscription: subscriptionStrategy(String(options.subscriptionStrategy)),
    footer: footerLayout(parseFooterConfig(options)),
    isDebug: options.debug === true,
  }
}
