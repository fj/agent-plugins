import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const ROOT = join(import.meta.dirname, '..')

export async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8'))
}

export function rootManifestPath(root = ROOT): string {
  return join(root, 'package.json')
}

export function readRootManifest(root = ROOT): Promise<Record<string, unknown>> {
  return readJson(rootManifestPath(root))
}
