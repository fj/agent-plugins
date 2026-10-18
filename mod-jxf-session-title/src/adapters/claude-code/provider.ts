export type ProviderFlags = {
  CLAUDE_CODE_USE_BEDROCK: string | undefined
  CLAUDE_CODE_USE_VERTEX: string | undefined
  CLAUDE_CODE_USE_FOUNDRY: string | undefined
}

const PROVIDER_OF_FLAG: readonly (readonly [keyof ProviderFlags, string])[] = [
  ['CLAUDE_CODE_USE_BEDROCK', 'bedrock'],
  ['CLAUDE_CODE_USE_VERTEX', 'vertex'],
  ['CLAUDE_CODE_USE_FOUNDRY', 'foundry'],
]

const DEFAULT_PROVIDER = 'anthropic'

const OFF_VALUES: ReadonlySet<string> = new Set(['', '0', 'false'])

const isOn = (value: string | undefined) => value !== undefined && !OFF_VALUES.has(value.trim().toLowerCase())

export function currentProvider(flags: ProviderFlags): string {
  return PROVIDER_OF_FLAG.find(([flag]) => isOn(flags[flag]))?.[1] ?? DEFAULT_PROVIDER
}
