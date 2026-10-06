export const HARNESSES = ['claude', 'pi'] as const

export type Harness = (typeof HARNESSES)[number]

export const HARNESS_NAMES: Record<Harness, string> = { claude: 'Claude Code', pi: 'Pi' }

export function isHarness(value: unknown): value is Harness {
  return HARNESSES.includes(value as Harness)
}

export function parseHarness(value: string | undefined): Harness {
  if (!isHarness(value)) throw new Error(`harness must be one of ${HARNESSES.join(', ')}; got ${value ?? 'nothing'}`)
  return value
}

export function parseHarnesses(values: string[]): Harness[] {
  return values.length ? values.map(parseHarness) : [...HARNESSES]
}
