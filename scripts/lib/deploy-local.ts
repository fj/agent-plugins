import { join } from 'node:path'

import { buildPlugin } from './build.ts'
import { deployDir } from './config.ts'
import { ensureMarketplace, switchPlugins } from './claude-cli.ts'
import type { Harness } from './harness.ts'
import { writeJson } from './json.ts'
import { discoverPlugins, supporting, type Plugin } from './manifest.ts'
import { LOCAL_MARKETPLACE, MARKETPLACE_FILE, RELEASED_MARKETPLACE, marketplace } from './marketplace.ts'
import { gitRepoOf, installPi, listPiPackages, removePi } from './pi-cli.ts'
import { SOURCE_REPO, piGitRepo } from './repos.ts'
import type { Run } from './run.ts'
import { pluginVersion } from './version.ts'

export type LocalContext = { root: string; dataDir: string; owner: string; run: Run; log: (line: string) => void }

type Deployed = { plugin: Plugin; version: string }

export async function deployLocal(ctx: LocalContext, harnesses: Harness[]): Promise<void> {
  const plugins = discoverPlugins(ctx.root)
  for (const harness of harnesses) {
    const deployed: Deployed[] = []
    for (const plugin of supporting(plugins, harness)) {
      const version = pluginVersion(ctx.root, plugin)
      const out = deployDir(ctx.dataDir, harness, plugin.manifest.name)
      await buildPlugin({ root: ctx.root, plugin, harness, version, out })
      ctx.log(`Built ${plugin.manifest.name} ${version} for ${harness} in ${out}`)
      deployed.push({ plugin, version })
    }
    await INSTALLERS[harness](ctx, deployed)
  }
}

const INSTALLERS: Record<Harness, (ctx: LocalContext, deployed: Deployed[]) => Promise<void>> = {
  claude: async ({ dataDir, owner, run, log }, deployed) => {
    const dir = join(dataDir, 'claude')
    const entries = deployed.map(({ plugin: { manifest }, version }) => ({
      name: manifest.name,
      description: manifest.description,
      version,
      source: `./${manifest.name}`,
    }))
    await writeJson(join(dir, MARKETPLACE_FILE), marketplace(LOCAL_MARKETPLACE, `Local builds of ${owner}/${SOURCE_REPO}.`, entries))
    ensureMarketplace(run, LOCAL_MARKETPLACE, dir, (m) => m.source === 'directory' && m.path === dir)
    switchPlugins(run, entries.map(({ name }) => name), RELEASED_MARKETPLACE, LOCAL_MARKETPLACE)
    log('Run /reload-plugins in Claude Code to load the new builds.')
  },
  pi: async ({ dataDir, owner, run }, deployed) => {
    const packages = listPiPackages(run)
    for (const { plugin } of deployed) {
      const { name } = plugin.manifest
      const path = deployDir(dataDir, 'pi', name)
      for (const { source } of packages) if (gitRepoOf(source) === piGitRepo(owner, name)) removePi(run, source)
      if (!packages.some((installed) => installed.path === path)) installPi(run, path)
    }
  },
}
