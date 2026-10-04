import { readFile, writeFile } from 'node:fs/promises'

import { readRootManifest, ROOT, rootManifestPath } from './root-manifest.ts'

const VERSION_FIELD = /"version":\s*"[^"]*"/

export async function readVersion(root = ROOT): Promise<string> {
  return (await readRootManifest(root)).version as string
}

export async function writeVersion(version: string, root = ROOT): Promise<void> {
  const path = rootManifestPath(root)
  const text = await readFile(path, 'utf8')

  if (!VERSION_FIELD.test(text)) throw new Error(`no version field in ${path}`)
  await writeFile(path, text.replace(VERSION_FIELD, `"version": "${version}"`))
}
