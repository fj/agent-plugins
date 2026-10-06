import { cp, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'

import { git, tryGit } from './git.ts'
import { MAIN, ORIGIN } from './index-checkout.ts'
import { releaseTag } from './repos.ts'

export type PublishRequest = {
  indexDir: string
  path: string
  url: string
  build: string
  version: string
  message: string
  createRepo: () => void
  log: (line: string) => void
}

export async function publishRelease({ indexDir, path, url, build, version, message, createRepo, log }: PublishRequest): Promise<boolean> {
  const repoDir = join(indexDir, path)
  const registered = isSubmodule(indexDir, path)

  if (registered) {
    git(indexDir, ['submodule', 'update', '--init', '--quiet', '--', path])
  } else {
    if (tryGit(indexDir, ['ls-remote', url]) === undefined) {
      log(`Creating ${url}`)
      createRepo()
    }
    git(indexDir, ['clone', '--quiet', url, path])
  }
  git(repoDir, ['fetch', '--quiet', '--tags', ORIGIN])

  const tag = releaseTag(version)
  if (tryGit(repoDir, ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`])) {
    log(`${path} already has ${tag}; skipping`)
    if (!registered) await rm(repoDir, { recursive: true, force: true })
    return false
  }

  checkoutMain(repoDir)
  await replaceTree(repoDir, build)
  git(repoDir, ['add', '--all'])
  git(repoDir, ['commit', '--quiet', '--message', message])
  git(repoDir, ['tag', '--annotate', tag, '--message', message.split('\n')[0]!])
  git(repoDir, ['push', '--quiet', '--atomic', ORIGIN, MAIN, tag])

  if (registered) {
    git(indexDir, ['add', '--', path])
  } else {
    git(indexDir, ['submodule', 'add', '--quiet', url, path])
    git(indexDir, ['submodule', 'absorbgitdirs', '--', path])
  }
  return true
}

function isSubmodule(indexDir: string, path: string): boolean {
  return git(indexDir, ['ls-files', '--stage', '--', path]).startsWith('160000 ')
}

function checkoutMain(repoDir: string): void {
  if (tryGit(repoDir, ['rev-parse', '--verify', '--quiet', `refs/remotes/${ORIGIN}/${MAIN}`])) {
    git(repoDir, ['checkout', '--quiet', '-B', MAIN, `${ORIGIN}/${MAIN}`])
  } else {
    git(repoDir, ['symbolic-ref', 'HEAD', `refs/heads/${MAIN}`])
  }
}

async function replaceTree(repoDir: string, build: string): Promise<void> {
  for (const entry of await readdir(repoDir)) {
    if (entry !== '.git') await rm(join(repoDir, entry), { recursive: true, force: true })
  }
  await cp(build, repoDir, { recursive: true })
}
