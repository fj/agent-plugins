const USER_ORIGINS: ReadonlySet<string> = new Set(['composer', 'bridge', 'sdk'])

export function isUserOrigin(origin: { kind: string }): boolean {
  return USER_ORIGINS.has(origin.kind)
}
