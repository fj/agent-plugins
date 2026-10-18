import { isEnvSet } from './env.ts'

const MS_PER_MINUTE = 60_000
const SHORT_TTL_MINUTES = 5
const LONG_TTL_MINUTES = 60

export const SHORT_TTL_MS = SHORT_TTL_MINUTES * MS_PER_MINUTE
export const LONG_TTL_MS = LONG_TTL_MINUTES * MS_PER_MINUTE

const TTL_MS: Readonly<Record<string, number>> = { '5m': SHORT_TTL_MS, '1h': LONG_TTL_MS }

export type ClaudeCodeCacheEnv = {
  disable?: string
  force5m?: string
  ttl?: string
  enable1h?: string
  enable1hBedrock?: string
}

export type ClaudeCodeCacheSource = {
  env: ClaudeCodeCacheEnv
  setting?: unknown
  isBedrock: boolean
  isSubscriber: boolean
}

export function claudeCodeCacheTtlMs({ env, setting, isBedrock, isSubscriber }: ClaudeCodeCacheSource): number | undefined {
  if (isEnvSet(env.disable)) {
    return undefined
  }

  if (isEnvSet(env.force5m)) {
    return SHORT_TTL_MS
  }

  const chosen = TTL_MS[env.ttl ?? ''] ?? TTL_MS[String(setting)]

  if (chosen !== undefined) {
    return chosen
  }

  const isLongEnabled = isEnvSet(env.enable1h) || (isBedrock && isEnvSet(env.enable1hBedrock))

  return isLongEnabled || isSubscriber ? LONG_TTL_MS : SHORT_TTL_MS
}

export function cacheRemainingMs(cachedAt: number | undefined, ttlMs: number | undefined, now: number): number | undefined {
  return cachedAt === undefined || ttlMs === undefined ? undefined : Math.max(0, cachedAt + ttlMs - now)
}
