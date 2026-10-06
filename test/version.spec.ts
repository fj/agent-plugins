import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import { discoverPlugins, findPlugin } from '../scripts/lib/manifest.ts'
import { pluginVersion, stampVersion } from '../scripts/lib/version.ts'
import { commitAll, makeRepo, manifest, tempDir, writeFiles } from './helpers.ts'

test('the patch is the UTC commit time', () => {
  assert.equal(stampVersion('1.4', new Date('2026-03-04T05:06:07+02:00')), '1.4.20260304030607')
})

test('the version comes from the newest commit that touches the plugin', async (t) => {
  const root = await makeRepo(
    join(await tempDir(t), 'repo'),
    { 'alpha/agent-plugin.json': manifest('alpha'), 'beta/agent-plugin.json': manifest('beta', { version: '2.0' }) },
    '2026-01-01T00:00:00Z',
  )
  await writeFiles(root, { 'alpha/notes.md': 'changed' })
  commitAll(root, 'touch alpha', '2026-02-03T04:05:06Z')
  await writeFiles(root, { 'beta/uncommitted.md': 'ignored' })

  const plugins = discoverPlugins(root)

  assert.equal(pluginVersion(root, findPlugin(plugins, 'alpha')), '0.1.20260203040506')
  assert.equal(pluginVersion(root, findPlugin(plugins, 'beta')), '2.0.20260101000000')
})
