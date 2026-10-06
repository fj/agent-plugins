import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const ROOT = join(import.meta.dirname, '..')

export async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function readPluginManifest(root = ROOT): Promise<Record<string, unknown>> {
  return readJson(join(root, 'agent-plugin.json'))
}
