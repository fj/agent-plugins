const PARTS = ['major', 'minor', 'patch'] as const
const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/

export function nextVersion(current: string, requested: string): string {
  const now = parse(current)
  const part = PARTS.indexOf(requested as (typeof PARTS)[number])

  if (part >= 0) return now.map((n, i) => (i < part ? n : i === part ? n + 1 : 0)).join('.')

  const next = parse(requested)
  if (compare(next, now) <= 0) throw new Error(`${requested} is not after ${current}`)
  return requested
}

function parse(version: string): number[] {
  const match = SEMVER.exec(version)
  if (!match) throw new Error(`${version} is not major, minor, patch or x.y.z`)
  return match.slice(1).map(Number)
}

function compare(a: number[], b: number[]): number {
  const i = a.findIndex((n, j) => n !== b[j])
  return i < 0 ? 0 : a[i]! - b[i]!
}
