import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

import { git, requireClean } from './git.ts'

export const MAIN = 'main'
export const ORIGIN = 'origin'

export function prepareIndex(indexDir: string, url: string, log: (line: string) => void): void {
  if (!existsSync(indexDir)) {
    log(`Cloning ${url} into ${indexDir}`)
    git(dirname(indexDir), ['clone', '--quiet', url, indexDir])
  }
  requireClean(indexDir)
  const remoteMain = git(indexDir, ['ls-remote', '--heads', ORIGIN, MAIN])
  if (!remoteMain) git(indexDir, ['symbolic-ref', 'HEAD', `refs/heads/${MAIN}`])

  const branch = git(indexDir, ['branch', '--show-current'])
  if (branch !== MAIN) throw new Error(`${indexDir} is on ${branch || 'a detached HEAD'}; switch it to ${MAIN}`)
  if (remoteMain) git(indexDir, ['pull', '--quiet', '--ff-only', ORIGIN, MAIN])
}
