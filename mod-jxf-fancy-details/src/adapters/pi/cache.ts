import { CLAUDE_BRIDGE_PROVIDER, type ModelInfo, type PromptCacheTiers } from '../../config/config.ts'
import { claudeCodeCacheTtlMs } from '../../core/cache.ts'

export type Env = Readonly<Record<string, string | undefined>>

const MS_PER_SECOND = 1000
const LONG_RETENTION = 'long'

export function piCacheTtlMs(tiers: PromptCacheTiers | undefined, retention: string | undefined): number | undefined {
  const seconds = retention === LONG_RETENTION ? tiers?.long : tiers?.short

  return seconds === undefined ? undefined : seconds * MS_PER_SECOND
}

export function cacheTtlMs(model: ModelInfo | undefined, env: Env): number | undefined {
  if (model?.provider !== CLAUDE_BRIDGE_PROVIDER) {
    return piCacheTtlMs(model?.promptCache, env.PI_CACHE_RETENTION)
  }

  return claudeCodeCacheTtlMs({
    env: {
      disable: env.DISABLE_PROMPT_CACHING,
      force5m: env.FORCE_PROMPT_CACHING_5M,
      ttl: env.CLAUDE_CODE_PROMPT_CACHE_TTL,
      enable1h: env.ENABLE_PROMPT_CACHING_1H,
    },
    isBedrock: false,
    isSubscriber: true,
  })
}
