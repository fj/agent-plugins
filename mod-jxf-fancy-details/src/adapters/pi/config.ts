import { readFileSync } from 'node:fs'

import { parseConfig, type FancyConfig } from '../../config/config.ts'

export const CONFIG_FILE = 'mod-jxf-fancy-details.json'

export function readConfig(path: string): FancyConfig {
  try {
    return parseConfig(readFileSync(path, 'utf8'))
  } catch {
    return {}
  }
}
