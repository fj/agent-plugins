export type TokenUsage = {
  input: number
  cacheRead: number
  cacheWrite: number
  output: number
}

export const ZERO_USAGE: TokenUsage = { input: 0, cacheRead: 0, cacheWrite: 0, output: 0 }

export function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    output: a.output + b.output,
  }
}

export function newInput(usage: TokenUsage): number {
  return usage.input + usage.cacheWrite
}

export function totalInput(usage: TokenUsage): number {
  return usage.input + usage.cacheRead + usage.cacheWrite
}
