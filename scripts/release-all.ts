import { main, parseCli, usage } from './lib/cli.ts'
import { parseHarness } from './lib/harness.ts'
import { releaseAll } from './lib/release.ts'
import { releaseContext } from './lib/release-context.ts'

await main(async () => {
  const { positionals, dryRun } = parseCli(process.argv.slice(2), { dryRun: true })
  if (positionals.length !== 1) usage('release:all <harness> [--dry-run]')

  const results = await releaseAll(releaseContext(dryRun), parseHarness(positionals[0]))
  console.log(results.length ? '\nSummary:' : `No plugins support ${positionals[0]}.`)
  for (const result of results) {
    console.log(`  ${result.plugin}: ${'error' in result ? `FAILED: ${result.error}` : `${result.outcome} ${result.version}`}`)
  }
  return results.every((result) => !('error' in result))
})
