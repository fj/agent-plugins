export type Cost = { usd: number; isLowerBound: boolean }

export const ZERO_COST: Cost = { usd: 0, isLowerBound: false }

export function addCost(a: Cost, b: Cost): Cost {
  return { usd: a.usd + b.usd, isLowerBound: a.isLowerBound || b.isLowerBound }
}
