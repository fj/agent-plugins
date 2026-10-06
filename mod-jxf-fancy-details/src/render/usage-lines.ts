import type { Cost } from '../core/cost.ts'
import type { TokenUsage } from '../core/usage.ts'
import type { Line } from './segment.ts'

export type TokenDisplay = { showsCachedInput: boolean }

export interface UsageLines {
  stepTokens(step: TokenUsage, session: TokenUsage, display: TokenDisplay): Line
  stepCost(step: Cost, session: Cost): Line
  totalTokens(total: TokenUsage, display: TokenDisplay): Line
}
