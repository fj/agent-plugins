import { readFileSync } from 'node:fs'

import { parseConfigText, type TitleConfig } from '../../config/config.ts'

export const CONFIG_FILE = 'mod-jxf-session-title.json'

export const DEFAULT_MODEL = 'claude-haiku-5-5'

export function readConfig(path: string): TitleConfig {
  try {
    return parseConfigText(readFileSync(path, 'utf8'), DEFAULT_MODEL)
  } catch {
    return parseConfigText('', DEFAULT_MODEL)
  }
}
