import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { git } from './git.ts'
import { readVersion, writeVersion } from './root-version.ts'
import { buildVariant, VARIANTS } from './variants.ts'
import { nextVersion } from './version.ts'

const MAIN = 'main'
const REMOTE = 'origin'

export type Publish = (dir: string, dryRun: boolean) => void

type ReleaseOptions = {
  root: string
  requested: string
  dryRun: boolean
  verify: () => void
  publish: Publish
}

export async function release({ root, requested, dryRun, verify, publish }: ReleaseOptions): Promise<string> {
  const version = nextVersion(await readVersion(root), requested)
  if (git(root, ['status', '--porcelain'])) throw new Error('commit or stash your changes before a release')
  if (git(root, ['branch', '--show-current']) !== MAIN) throw new Error(`release from ${MAIN}`)

  verify()
  const scratch = await mkdtemp(join(tmpdir(), 'release-'))
  try {
    const dirs = VARIANTS.map((variant) => join(scratch, variant.name))
    for (const [i, variant] of VARIANTS.entries()) await buildVariant(variant, dirs[i]!, root, version)
    for (const dir of dirs) publish(dir, true)
    if (dryRun) return version

    await writeVersion(version, root)
    git(root, ['commit', '--all', '--message', `chore: release ${version}`])
    git(root, ['tag', `v${version}`])
    for (const dir of dirs) publish(dir, false)
    git(root, ['push', '--atomic', REMOTE, MAIN, `v${version}`])
    return version
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}
