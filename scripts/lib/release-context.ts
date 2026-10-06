import { githubRepoCreator } from './github.ts'
import type { ReleaseContext } from './release.ts'
import { run } from './run.ts'
import { settings } from './config.ts'

export function releaseContext(dryRun: boolean): ReleaseContext {
  const { root, owner, remoteBase, indexDir } = settings()
  return { root, owner, remoteBase, indexDir, createRepo: githubRepoCreator(run, owner), log: console.log, dryRun }
}
