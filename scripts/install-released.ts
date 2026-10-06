import { main, parseCli } from './lib/cli.ts'
import { settings } from './lib/config.ts'
import { parseHarnesses } from './lib/harness.ts'
import { installReleased } from './lib/install-released.ts'
import { INDEX_REPO, remoteUrl } from './lib/repos.ts'
import { run } from './lib/run.ts'

await main(async () => {
  const harnesses = parseHarnesses(parseCli(process.argv.slice(2)).positionals)
  const { indexDir, remoteBase, owner, dataDir } = settings()
  await installReleased({ indexDir, indexUrl: remoteUrl(remoteBase, INDEX_REPO), owner, dataDir, run, log: console.log }, harnesses)
})
