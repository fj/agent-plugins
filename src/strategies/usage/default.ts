import type { Cost } from '../../core/cost.ts'
import { newInput, totalInput, type TokenUsage } from '../../core/usage.ts'
import { formatTokens, formatUsd } from '../../render/format.ts'
import { seg, type Line } from '../../render/segment.ts'
import type { TokenDisplay } from '../../render/usage-lines.ts'
import { CACHE_WRITE_MULTIPLIER, ratesFor } from './pricing.ts'
import type { UsageStrategy } from './strategy.ts'

const TOKENS_PER_MTOK = 1_000_000

function price(model: string, usage: TokenUsage): Cost {
  const rates = ratesFor(model)

  if (rates === undefined) {
    return { usd: 0, isLowerBound: true }
  }

  const usd =
    (usage.input * rates.input +
      usage.cacheWrite * rates.input * CACHE_WRITE_MULTIPLIER +
      usage.cacheRead * rates.cacheRead +
      usage.output * rates.output) /
    TOKENS_PER_MTOK

  return { usd, isLowerBound: false }
}

function stepInput(step: TokenUsage, display: TokenDisplay): Line {
  if (!display.showsCachedInput) {
    return [seg('Δ ', 'muted'), seg(formatTokens(totalInput(step)), 'input')]
  }

  return [
    seg('( Δ ', 'muted'),
    seg(formatTokens(newInput(step)), 'input'),
    seg(' + ⟲ ', 'muted'),
    seg(formatTokens(step.cacheRead), 'cache'),
    seg(' )', 'muted'),
  ]
}

function stepTokens(step: TokenUsage, session: TokenUsage, display: TokenDisplay): Line {
  return [
    seg('↑ ', 'muted'),
    ...stepInput(step, display),
    seg(' / Σ ', 'muted'),
    seg(formatTokens(totalInput(session)), 'input'),
    seg(' · ↓ Δ ', 'muted'),
    seg(formatTokens(step.output), 'output'),
    seg(' / Σ ', 'muted'),
    seg(formatTokens(session.output), 'output'),
  ]
}

function stepCost(step: Cost, session: Cost): Line {
  return [seg('Δ ', 'muted'), seg(formatUsd(step), 'cost'), seg(' / Σ ', 'muted'), seg(formatUsd(session), 'cost')]
}

function cachedInput(total: TokenUsage): Line {
  return [
    seg('(Δ', 'muted'),
    seg(formatTokens(newInput(total)), 'input'),
    seg(' + ⟲ ', 'muted'),
    seg(formatTokens(total.cacheRead), 'cache'),
    seg(')/', 'muted'),
  ]
}

function totalTokens(total: TokenUsage, display: TokenDisplay): Line {
  return [
    seg('↑', 'muted'),
    ...(display.showsCachedInput ? cachedInput(total) : []),
    seg(formatTokens(totalInput(total)), 'input'),
    seg(' ↓', 'muted'),
    seg(formatTokens(total.output), 'output'),
  ]
}

export const defaultUsageStrategy: UsageStrategy = { name: 'default', price, stepTokens, stepCost, totalTokens }
