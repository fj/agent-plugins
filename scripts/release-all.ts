import { main, parseCli, usage } from './lib/cli.ts'
import { parseHarness } from './lib/harness.ts'
import { reportReleaseAll } from './lib/release-all.ts'
import { releaseContext } from './lib/release-context.ts'

await main(async () => {
  const { positionals, dryRun } = parseCli(process.argv.slice(2), { dryRun: true })
  if (positionals.length !== 1) usage('release:all <harness> [--dry-run]')

  return reportReleaseAll(releaseContext(dryRun), parseHarness(positionals[0]))
})
