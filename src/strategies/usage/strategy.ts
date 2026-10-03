import type { Cost } from '../../core/cost.ts'
import type { TokenUsage } from '../../core/usage.ts'
import type { UsageLines } from '../../render/usage-lines.ts'

export interface UsageStrategy extends UsageLines {
  readonly name: string
  price(model: string, usage: TokenUsage): Cost
}
