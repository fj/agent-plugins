import { ensureMarketplace, switchPlugins } from './claude-cli.ts'
import { deployDir } from './config.ts'
import type { Harness } from './harness.ts'
import { prepareIndex } from './index-checkout.ts'
import { readReleases, type Releases } from './index-files.ts'
import { LOCAL_MARKETPLACE, RELEASED_MARKETPLACE } from './marketplace.ts'
import { gitRepoOf, installPi, listPiPackages, removePi } from './pi-cli.ts'
import { INDEX_REPO, piGitRepo, piGitSource } from './repos.ts'
import type { Run } from './run.ts'

export type ReleasedContext = {
  indexDir: string
  indexUrl: string
  owner: string
  dataDir: string
  run: Run
  log: (line: string) => void
}

export async function installReleased(ctx: ReleasedContext, harnesses: Harness[]): Promise<void> {
  prepareIndex(ctx.indexDir, ctx.indexUrl, ctx.log)
  const releases = await readReleases(ctx.indexDir)
  for (const harness of harnesses) INSTALLERS[harness](ctx, releases)
}

const released = (releases: Releases, harness: Harness) =>
  Object.entries(releases).flatMap(([name, plugin]) => (plugin[harness] ? [{ name, version: plugin[harness].version }] : []))

const INSTALLERS: Record<Harness, (ctx: ReleasedContext, releases: Releases) => void> = {
  claude: ({ owner, run, log }, releases) => {
    const repo = `${owner}/${INDEX_REPO}`
    ensureMarketplace(run, RELEASED_MARKETPLACE, repo, (m) => m.source === 'github' && m.repo === repo)
    switchPlugins(run, released(releases, 'claude').map(({ name }) => name), LOCAL_MARKETPLACE, RELEASED_MARKETPLACE)
    log('Run /reload-plugins in Claude Code to load the released versions.')
  },
  pi: ({ owner, dataDir, run }, releases) => {
    const packages = listPiPackages(run)
    for (const { name, version } of released(releases, 'pi')) {
      const target = piGitSource(owner, name, version)
      const local = deployDir(dataDir, 'pi', name)
      for (const { source, path } of packages) {
        const replaced = path === local || (gitRepoOf(source) === piGitRepo(owner, name) && source !== target)
        if (replaced) removePi(run, source)
      }
      if (!packages.some(({ source }) => source === target)) installPi(run, target)
    }
  },
}
