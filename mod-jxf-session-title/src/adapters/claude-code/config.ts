import type { PluginOptions } from 'claude-code'

import { parseConfig, type TitleConfig } from '../../config/config.ts'

export const DEFAULT_MODEL = 'haiku'

export function configFrom(options: PluginOptions): TitleConfig {
  return parseConfig(options, DEFAULT_MODEL)
}
