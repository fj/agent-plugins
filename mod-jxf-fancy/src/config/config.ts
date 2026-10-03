export type FancyConfig = { usageStrategy?: string; subscriptionStrategy?: string }

export type ModelInfo = { id: string; provider: string }

const ANTHROPIC_PROVIDER = 'anthropic'

const optionalString = (value: unknown) => (typeof value === 'string' ? value : undefined)

export function parseConfig(text: string): FancyConfig {
  try {
    const value = JSON.parse(text) as Record<string, unknown>

    return {
      usageStrategy: optionalString(value?.usageStrategy),
      subscriptionStrategy: optionalString(value?.subscriptionStrategy),
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
