const PARTS = ['major', 'minor', 'patch'] as const
const RELEASED = /^(\d+)\.(\d+)\.(\d+)$/
const REQUESTED = /^(\d+)\.(\d+)$/
const STAMP_LENGTH = 'YYYYMMDDhhmmss'.length

export function stamped(current: string, time: Date): string {
  const [major, minor] = parse(current, RELEASED, 'x.y.z')
  return [major, minor, stamp(time)].join('.')
}

export function nextVersion(current: string, requested: string, time: Date): string {
  const now = parse(current, RELEASED, 'x.y.z')
  const part = PARTS.indexOf(requested as (typeof PARTS)[number])
  const line =
    part >= 0
      ? now.slice(0, 2).map((n, i) => (i < part ? n : i === part ? n + 1 : 0))
      : parse(requested, REQUESTED, 'major, minor, patch or x.y')
  const next = [...line, Number(stamp(time))]

  if (compare(next, now) <= 0) throw new Error(`${next.join('.')} is not after ${current}`)
  return next.join('.')
}

function stamp(time: Date): string {
  return time.toISOString().replace(/\D/g, '').slice(0, STAMP_LENGTH)
}

function parse(version: string, pattern: RegExp, expected: string): number[] {
  const match = pattern.exec(version)
  if (!match) throw new Error(`${version} is not ${expected}`)
  return match.slice(1).map(Number)
}

function compare(a: number[], b: number[]): number {
  const i = a.findIndex((n, j) => n !== b[j])
  return i < 0 ? 0 : a[i]! - b[i]!
}
