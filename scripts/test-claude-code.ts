import { spawnSync } from 'node:child_process'
import { cp, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ROOT } from './root-manifest.ts'
import { buildVariant, VARIANTS } from './variants.ts'

const TESTS = join('test', 'adapters', 'claude-code')
const variant = VARIANTS.find(({ name }) => name === 'claude-code')!
const out = await mkdtemp(join(tmpdir(), 'mod-jxf-fancy-claude-code-'))

try {
  await buildVariant(variant, out)
  await cp(join(ROOT, TESTS), join(out, TESTS), { recursive: true })
  process.exitCode = spawnSync('claude', ['plugin', 'test', out], { stdio: 'inherit' }).status ?? 1
} finally {
  await rm(out, { recursive: true, force: true })
}
