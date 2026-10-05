import type { PluginOptions } from 'claude-code'

import { footerLayout, parseDisplayConfig, parseFooterConfig, tokenDisplay } from '../../config/config.ts'
import type { FooterLayout } from '../../render/footer.ts'
import type { TokenDisplay } from '../../render/usage-lines.ts'
import { subscriptionStrategy, type SubscriptionStrategy } from '../../strategies/subscription/index.ts'
import { usageStrategy, type UsageStrategy } from '../../strategies/usage/index.ts'

export type FooterPlacement = 'belowPrompt' | 'abovePrompt'

export type Config = {
  usage: UsageStrategy
  subscription: SubscriptionStrategy
  footer: FooterLayout
  display: TokenDisplay
  footerPlacement: FooterPlacement
  isDebug: boolean
}

function footerPlacement(value: unknown): FooterPlacement {
  return value === 'abovePrompt' ? 'abovePrompt' : 'belowPrompt'
}

export function configFrom(options: PluginOptions): Config {
  return {
    usage: usageStrategy(String(options.usageStrategy)),
    subscription: subscriptionStrategy(String(options.subscriptionStrategy)),
    footer: footerLayout(parseFooterConfig(options)),
    display: tokenDisplay(parseDisplayConfig(options)),
    footerPlacement: footerPlacement(options.footerPlacement),
    isDebug: options.debug === true,
  }
}
