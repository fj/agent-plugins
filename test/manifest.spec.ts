import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'

import { discoverPlugins, findPlugin, supporting, validateManifest } from '../scripts/lib/manifest.ts'
import { commitAll, makeRepo, manifest, tempDir, writeFiles } from './helpers.ts'

const DATE = '2026-01-02T03:04:05Z'
const valid = () => JSON.parse(manifest('demo'))

test('a valid manifest passes', () => {
  assert.deepEqual(validateManifest(valid(), 'demo'), valid())
})

test('the name must match the directory', () => {
  assert.throws(() => validateManifest(valid(), 'other'), /name must be "other"/)
})

test('the version must be major.minor', () => {
  for (const version of ['1', '1.2.3', 'v1.2', 1.2]) {
    assert.throws(() => validateManifest({ ...valid(), version }, 'demo'), /version must be major.minor/)
  }
})

test('harnesses must be known and not empty', () => {
  for (const harnesses of [[], ['claude', 'codex'], 'claude']) {
    assert.throws(() => validateManifest({ ...valid(), harnesses }, 'demo'), /harnesses must be/)
  }
})

test('all problems are reported together', () => {
  assert.throws(
    () => validateManifest({ name: 'x', version: '1', harnesses: [], build: 3 }, 'demo'),
    (error: Error) =>
      ['name must', 'description must', 'version must', 'harnesses must', 'build must'].every((p) => error.message.includes(p)),
  )
})

test('discovery finds committed top-level plugins only', async (t) => {
  const root = await makeRepo(
    join(await tempDir(t), 'repo'),
    {
      'alpha/agent-plugin.json': manifest('alpha', { harnesses: ['claude'] }),
      'beta/agent-plugin.json': manifest('beta', { harnesses: ['pi'] }),
      'scripts/tool.ts': '',
      'nested/deeper/agent-plugin.json': manifest('deeper'),
    },
    DATE,
  )
  await writeFiles(root, { 'gamma/agent-plugin.json': manifest('gamma') })

  const plugins = discoverPlugins(root)

  assert.deepEqual(plugins.map(({ path }) => path), ['alpha', 'beta'])
  assert.equal(findPlugin(plugins, 'beta').manifest.harnesses[0], 'pi')
  assert.deepEqual(supporting(plugins, 'claude').map(({ path }) => path), ['alpha'])
  assert.throws(() => findPlugin(plugins, 'gamma'), /no plugin named gamma/)
})

test('discovery rejects an invalid manifest', async (t) => {
  const root = await makeRepo(join(await tempDir(t), 'repo'), { 'alpha/agent-plugin.json': manifest('beta') }, DATE)
  assert.throws(() => discoverPlugins(root), /alpha\/agent-plugin.json is invalid/)
  await writeFiles(root, { 'alpha/agent-plugin.json': '{' })
  commitAll(root, 'broken', DATE)
  assert.throws(() => discoverPlugins(root), /is not valid JSON/)
})
