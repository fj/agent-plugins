export type Cost = { usd: number; isLowerBound: boolean }

export const ZERO_COST: Cost = { usd: 0, isLowerBound: false }

export function addCost(a: Cost, b: Cost): Cost {
  return { usd: a.usd + b.usd, isLowerBound: a.isLowerBound || b.isLowerBound }
}

export function isCost(value: unknown): value is Cost {
  const cost = value as Cost | undefined

  return (
    typeof cost?.usd === 'number' &&
    Number.isFinite(cost.usd) &&
    cost.usd >= 0 &&
    typeof cost.isLowerBound === 'boolean'
  )
}
