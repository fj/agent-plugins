import { lastChange } from './git.ts'
import type { Plugin } from './manifest.ts'

const STAMP_LENGTH = 'yyyymmddhhmmss'.length

export function stampVersion(majorMinor: string, time: Date): string {
  return `${majorMinor}.${time.toISOString().replace(/\D/g, '').slice(0, STAMP_LENGTH)}`
}

export function pluginVersion(root: string, plugin: Plugin): string {
  return stampVersion(plugin.manifest.version, lastChange(root, plugin.path))
}
