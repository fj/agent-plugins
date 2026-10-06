import { main, parseCli } from './lib/cli.ts'
import { settings } from './lib/config.ts'
import { deployLocal } from './lib/deploy-local.ts'
import { parseHarnesses } from './lib/harness.ts'
import { run } from './lib/run.ts'

await main(async () => {
  const harnesses = parseHarnesses(parseCli(process.argv.slice(2)).positionals)
  const { root, dataDir, owner } = settings()
  await deployLocal({ root, dataDir, owner, run, log: console.log }, harnesses)
})
