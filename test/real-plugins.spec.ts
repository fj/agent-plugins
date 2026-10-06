import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { buildPlugin } from '../scripts/lib/build.ts'
import { ROOT } from '../scripts/lib/config.ts'
import { discoverPlugins } from '../scripts/lib/manifest.ts'
import { pluginVersion } from '../scripts/lib/version.ts'
import { tempDir } from './helpers.ts'

const UNRENDERED_REFERENCE = '{{command:'

const plugins = discoverPlugins(ROOT)

async function filesWithUnrenderedReferences(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true })
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name))
  const texts = await Promise.all(files.map((file) => readFile(file, 'utf8')))
  return files.filter((_, i) => texts[i]!.includes(UNRENDERED_REFERENCE))
}

test('the repo has the expected plugins', () => {
  assert.deepEqual(plugins.map(({ manifest }) => manifest.name).sort(), ['foundry-finder', 'jxf', 'mod-jxf-fancy-details'])
})

for (const plugin of plugins) {
  for (const harness of plugin.manifest.harnesses) {
    test(`${plugin.manifest.name} builds a valid ${harness} package with every command reference rendered`, async (t) => {
      const out = join(await tempDir(t), 'build')
      await buildPlugin({ root: ROOT, plugin, harness, version: pluginVersion(ROOT, plugin), out })
      assert.deepEqual(await filesWithUnrenderedReferences(out), [])
    })
  }
}
