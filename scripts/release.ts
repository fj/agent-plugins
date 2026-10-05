import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { git } from './git.ts'
import { readVersion, writeVersion } from './root-version.ts'
import { buildVariant, VARIANTS, type Variant } from './variants.ts'
import { nextVersion } from './version.ts'

const MAIN = 'main'
const REMOTE = 'origin'

export const releaseBranch = (variant: Variant) => `release/${variant.name}`

type ReleaseOptions = {
  root: string
  requested: string
  dryRun: boolean
  verify: () => void
}

export async function release({ root, requested, dryRun, verify }: ReleaseOptions): Promise<string> {
  const version = nextVersion(await readVersion(root), requested)
  if (git(root, ['status', '--porcelain'])) throw new Error('commit or stash your changes before a release')
  if (git(root, ['branch', '--show-current']) !== MAIN) throw new Error(`release from ${MAIN}`)

  verify()
  const scratch = await mkdtemp(join(tmpdir(), 'release-'))
  try {
    const dirs = VARIANTS.map((variant) => join(scratch, variant.name))
    for (const [i, variant] of VARIANTS.entries()) await buildVariant(variant, dirs[i]!, root, version)
    if (dryRun) return version

    const message = `chore: release ${version}`
    await writeVersion(version, root)
    git(root, ['commit', '--all', '--message', message])
    git(root, ['tag', `v${version}`])
    for (const [i, variant] of VARIANTS.entries()) commitBuild(root, dirs[i]!, releaseBranch(variant), message)
    git(root, ['push', '--atomic', REMOTE, MAIN, `v${version}`, ...VARIANTS.map(releaseBranch)])
    return version
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }
}

function commitBuild(root: string, dir: string, branch: string, message: string): void {
  const env = {
    ...process.env,
    GIT_DIR: resolve(root, git(root, ['rev-parse', '--git-dir'])),
    GIT_WORK_TREE: dir,
    GIT_INDEX_FILE: `${dir}.index`,
  }
  const parent = tipOf(root, branch)

  git(dir, ['add', '--all'], env)
  const tree = git(dir, ['write-tree'], env)
  const commit = git(root, ['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message])
  git(root, ['update-ref', `refs/heads/${branch}`, commit])
}

function tipOf(root: string, branch: string): string | undefined {
  for (const ref of [`refs/heads/${branch}`, `refs/remotes/${REMOTE}/${branch}`]) {
    try {
      return git(root, ['rev-parse', '--verify', '--quiet', ref])
    } catch {}
  }
  return undefined
}
