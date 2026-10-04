import type { FooterLayout } from '../render/footer.ts'

export type FooterConfig = { combineTotals?: boolean; showSubscription?: boolean; showContext?: boolean }

export type FancyConfig = { usageStrategy?: string; subscriptionStrategy?: string } & FooterConfig

export type ModelInfo = { id: string; provider: string }

const ANTHROPIC_PROVIDER = 'anthropic'

const optionalString = (value: unknown) => (typeof value === 'string' ? value : undefined)

const optionalBoolean = (value: unknown) => (typeof value === 'boolean' ? value : undefined)

export function parseFooterConfig(value: Readonly<Record<string, unknown>> | null): FooterConfig {
  return {
    combineTotals: optionalBoolean(value?.combineTotals),
    showSubscription: optionalBoolean(value?.showSubscription),
    showContext: optionalBoolean(value?.showContext),
  }
}

export function footerLayout(config: FooterConfig): FooterLayout {
  return {
    isTotalsCombined: config.combineTotals ?? false,
    showsSubscription: config.showSubscription ?? true,
    showsContext: config.showContext ?? true,
  }
}

export function parseConfig(text: string): FancyConfig {
  try {
    const value = JSON.parse(text) as Record<string, unknown> | null

    return {
      usageStrategy: optionalString(value?.usageStrategy),
      subscriptionStrategy: optionalString(value?.subscriptionStrategy),
      ...parseFooterConfig(value),
    }
  } catch {
    return {}
  }
}

export function subscriptionName(
  config: FancyConfig,
  model: ModelInfo | undefined,
  isUsingOAuth: (model: ModelInfo) => boolean,
): string {
  if (config.subscriptionStrategy !== undefined) {
    return config.subscriptionStrategy
  }

  return model?.provider === ANTHROPIC_PROVIDER && isUsingOAuth(model) ? 'anthropic' : 'null'
}
