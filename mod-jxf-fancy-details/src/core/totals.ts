import { addCost, ZERO_COST, type Cost } from './cost.ts'
import { addUsage, ZERO_USAGE, type TokenUsage } from './usage.ts'

export type Totals = { usage: TokenUsage; cost: Cost; activeMs: number }

export const ZERO_TOTALS: Totals = { usage: ZERO_USAGE, cost: ZERO_COST, activeMs: 0 }

export function addTotals(a: Totals, b: Totals): Totals {
  return {
    usage: addUsage(a.usage, b.usage),
    cost: addCost(a.cost, b.cost),
    activeMs: a.activeMs + b.activeMs,
  }
}

export function sumTotals(list: readonly Totals[]): Totals {
  return list.reduce(addTotals, ZERO_TOTALS)
}
