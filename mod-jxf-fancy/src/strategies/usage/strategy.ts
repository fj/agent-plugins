import type { Cost } from '../../core/cost.ts'
import type { TokenUsage } from '../../core/usage.ts'
import type { Line } from '../../render/segment.ts'

export interface UsageStrategy {
  readonly name: string
  price(model: string, usage: TokenUsage): Cost
  stepTokens(step: TokenUsage, session: TokenUsage): Line
  stepCost(step: Cost, session: Cost): Line
  totalTokens(total: TokenUsage): Line
}
