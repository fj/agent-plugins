import type { Cost } from '../../core/cost.ts'
import { totalInput, type TokenUsage } from '../../core/usage.ts'

export type RateTier = {
  inputTokensAbove: number
  input: number
  output: number
  cacheRead: number
  cacheWrite?: number
}

export type Rates = {
  input: number
  output: number
  cacheRead: number
  cacheWrite?: number
  tiers?: readonly RateTier[]
}

export const CACHE_WRITE_MULTIPLIER = 1.25

const TOKENS_PER_MTOK = 1_000_000

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
const PROVIDER_PATH_PREFIX = /^(?:[a-z0-9._-]+\/)+/
const BEDROCK_ANTHROPIC_PREFIX = /^(?:[a-z]+\.)*anthropic\./

export function canonicalModel(model: string): string {
  return model
    .trim()
    .toLowerCase()
    .replace(CONTEXT_SUFFIX, '')
    .replace(PROVIDER_PATH_PREFIX, '')
    .replace(BEDROCK_ANTHROPIC_PREFIX, '')
    .replace(/[@:].*$/, '')
    .replace(DATE_SUFFIX, '')
}

export function ratesFor(model: string): Rates | undefined {
  return PUBLIC_RATES_PER_MTOK[canonicalModel(model)]
}

export function hasKnownRates(rates: Rates | undefined): rates is Rates {
  if (rates === undefined) {
    return false
  }

  const hasBase = rates.input > 0 || rates.output > 0 || rates.cacheRead > 0 || (rates.cacheWrite ?? 0) > 0

  return hasBase || (rates.tiers ?? []).some(hasKnownRates)
}

function selectTier(rates: Rates, inputTokens: number): Rates {
  let chosen: Rates = rates
  let threshold = -1

  for (const tier of rates.tiers ?? []) {
    if (inputTokens > tier.inputTokensAbove && tier.inputTokensAbove > threshold) {
      chosen = tier
      threshold = tier.inputTokensAbove
    }
  }

  return chosen
}

export function priceWithRates(rates: Rates, usage: TokenUsage): Cost {
  const tier = selectTier(rates, totalInput(usage))
  const cacheWriteRate = tier.cacheWrite ?? tier.input * CACHE_WRITE_MULTIPLIER
  const usd =
    (usage.input * tier.input +
      usage.cacheWrite * cacheWriteRate +
      usage.cacheRead * tier.cacheRead +
      usage.output * tier.output) /
    TOKENS_PER_MTOK

  return { usd, isLowerBound: false }
}
