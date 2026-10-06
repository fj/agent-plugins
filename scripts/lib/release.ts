import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { buildPlugin } from './build.ts'
import { git, headSha, requireClean } from './git.ts'
import type { RepoCreator } from './github.ts'
import { HARNESS_NAMES, type Harness } from './harness.ts'
import { MAIN, ORIGIN, prepareIndex } from './index-checkout.ts'
import { readReleases, recordRelease, writeIndexFiles } from './index-files.ts'
import { discoverPlugins, supporting, type Plugin } from './manifest.ts'
import { publishRelease } from './release-repo.ts'
import { INDEX_REPO, SOURCE_REPO, releaseRepo, remoteUrl, submodulePath } from './repos.ts'
import { shell } from './run.ts'
import { pluginVersion } from './version.ts'

export type ReleaseContext = {
  root: string
  owner: string
  remoteBase: string
  indexDir: string
  createRepo: RepoCreator
  log: (line: string) => void
  dryRun: boolean
}

export type Outcome = 'released' | 'skipped' | 'dry run'
export type ReleaseResult = { plugin: string; version: string; outcome: Outcome }

export async function releasePlugin(ctx: ReleaseContext, plugin: Plugin, harness: Harness): Promise<ReleaseResult> {
  const { root, log } = ctx
  const { name, test } = plugin.manifest
  requireClean(root)

  const version = pluginVersion(root, plugin)
  if (test) {
    log(`Testing ${name}: ${test}`)
    shell(test, join(root, plugin.path))
  }
  const build = await mkdtemp(join(tmpdir(), 'agent-plugin-build-'))
  try {
    await buildPlugin({ root, plugin, harness, version, out: build })
    if (ctx.dryRun) {
      const files = (await readdir(build, { recursive: true, withFileTypes: true })).filter((entry) => entry.isFile())
      log(`Would release ${name} ${version} for ${harness} with ${files.length} files`)
      return { plugin: name, version, outcome: 'dry run' }
    }
    const published = await publish(ctx, plugin, harness, version, build)
    return { plugin: name, version, outcome: published ? 'released' : 'skipped' }
  } finally {
    await rm(build, { recursive: true, force: true })
  }
}

async function publish(ctx: ReleaseContext, plugin: Plugin, harness: Harness, version: string, build: string): Promise<boolean> {
  const { root, owner, remoteBase, indexDir, log } = ctx
  const { name, description } = plugin.manifest
  const repo = releaseRepo(name, harness)
  const path = submodulePath(name, harness)
  const source = `${owner}/${SOURCE_REPO}`

  prepareIndex(indexDir, remoteUrl(remoteBase, INDEX_REPO), log)
  const published = await publishRelease({
    indexDir,
    path,
    url: remoteUrl(remoteBase, repo),
    build,
    version,
    message: `release: ${name} ${version}\n\nSource: ${source}@${headSha(root)}`,
    createRepo: () => ctx.createRepo(repo, `${name} for ${HARNESS_NAMES[harness]}, released from ${source}. Write-only.`),
    log,
  })
  if (!published) return false

  const releases = recordRelease(await readReleases(indexDir), name, description, harness, { repo: `${owner}/${repo}`, version })
  const files = await writeIndexFiles(indexDir, releases, owner)
  git(indexDir, ['add', '--', ...files])
  git(indexDir, ['commit', '--quiet', '--message', `release: ${path} ${version}`])
  git(indexDir, ['push', '--quiet', ORIGIN, MAIN])
  log(`Released ${name} ${version} for ${harness}`)
  return true
}

export type BatchResult = { plugin: string } & ({ outcome: Outcome; version: string } | { error: string })

export async function releaseAll(ctx: ReleaseContext, harness: Harness): Promise<BatchResult[]> {
  const results: BatchResult[] = []
  for (const plugin of supporting(discoverPlugins(ctx.root), harness)) {
    try {
      results.push(await releasePlugin(ctx, plugin, harness))
    } catch (error) {
      results.push({ plugin: plugin.manifest.name, error: (error as Error).message })
    }
  }
  return results
}
