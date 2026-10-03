export type Rates = { input: number; output: number; cacheRead: number }

export const CACHE_WRITE_MULTIPLIER = 1.25

export const PUBLIC_RATES_PER_MTOK: Readonly<Record<string, Rates>> = {
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-mythos-5-1': { input: 10, output: 50, cacheRead: 0.25 },
  'claude-fable-5': { input: 10, output: 50, cacheRead: 1 },
  'claude-mythos-5': { input: 10, output: 50, cacheRead: 1 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-8': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-7': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-opus-4-6': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-sonnet-4-6': { input: 3, output: 15, cacheRead: 0.3 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1 },
}

const DATE_SUFFIX = /-\d{8}$/
const CONTEXT_SUFFIX = /\[[^\]]*\]$/
const PROVIDER_PREFIX = /^(?:[a-z]+\.)*anthropic\.|^[a-z0-9-]+\//

export function canonicalModel(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(CONTEXT_SUFFIX, '')
    .replace(PROVIDER_PREFIX, '')
    .replace(/[@:].*$/, '')
    .replace(DATE_SUFFIX, '')
}

export function ratesFor(model: string): Rates | undefined {
  return PUBLIC_RATES_PER_MTOK[canonicalModel(model)]
}
