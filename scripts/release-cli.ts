import { execFileSync } from 'node:child_process'
import { parseArgs } from 'node:util'

import { release } from './release.ts'
import { ROOT } from './root-manifest.ts'

const USAGE = 'usage: npm run release -- <major|minor|patch|x.y.z> [--dry-run]'

const { positionals, values } = parseArgs({ allowPositionals: true, options: { 'dry-run': { type: 'boolean' } } })
if (positionals.length !== 1) throw new Error(USAGE)

const dryRun = values['dry-run'] ?? false
const npm = (args: string[]) => execFileSync('npm', args, { cwd: ROOT, stdio: 'inherit' })
const version = await release({
  root: ROOT,
  requested: positionals[0]!,
  dryRun,
  verify: () => {
    npm(['test'])
    npm(['run', 'test:claude-code'])
  },
})

console.log(dryRun ? `dry run of ${version}: nothing committed or pushed` : `released ${version}`)
