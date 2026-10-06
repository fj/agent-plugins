import { main, parseCli, usage } from './lib/cli.ts'
import { parseHarness } from './lib/harness.ts'
import { discoverPlugins, findPlugin } from './lib/manifest.ts'
import { releasePlugin } from './lib/release.ts'
import { releaseContext } from './lib/release-context.ts'

await main(async () => {
  const { positionals, dryRun } = parseCli(process.argv.slice(2), { dryRun: true })
  const [harness, name] = positionals
  if (positionals.length !== 2) usage('release <harness> <plugin> [--dry-run]')

  const ctx = releaseContext(dryRun)
  const target = parseHarness(harness)
  await releasePlugin(ctx, findPlugin(discoverPlugins(ctx.root), name!), target)
})
