import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { buildGeneric } from './generic-build.ts'
import { exportAtHead } from './git.ts'
import type { Harness } from './harness.ts'
import type { Plugin } from './manifest.ts'
import { validateNativePackage } from './native.ts'
import { quote, shell } from './run.ts'

export type BuildRequest = { root: string; plugin: Plugin; harness: Harness; version: string; out: string }

export async function buildPlugin({ root, plugin, harness, version, out }: BuildRequest): Promise<void> {
  const { manifest } = plugin
  if (!manifest.harnesses.includes(harness)) throw new Error(`${manifest.name} does not support ${harness}`)

  const target = resolve(out)
  const scratch = await mkdtemp(join(tmpdir(), 'agent-plugin-source-'))
  try {
    exportAtHead(root, plugin.path, scratch)
    const source = join(scratch, plugin.path)
    await rm(target, { recursive: true, force: true })
    await mkdir(target, { recursive: true })

    if (manifest.build) {
      shell(`${manifest.build} --harness ${harness} --out ${quote(target)} --version ${version}`, source)
    } else {
      await buildGeneric(source, manifest, harness, target, version)
    }
    await validateNativePackage(target, harness, manifest.name, version)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
