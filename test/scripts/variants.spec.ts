import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, before, test } from 'node:test'

import { readRootManifest } from '../../scripts/root-manifest.ts'
import { buildVariant, VARIANTS, type Variant } from '../../scripts/variants.ts'

const byName = (name: string) => VARIANTS.find((variant) => variant.name === name)!
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'))

let scratch: string
const outOf = (variant: Variant) => join(scratch, variant.name)

before(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'variants-spec-'))
  for (const variant of VARIANTS) await buildVariant(variant, outOf(variant))
})

after(() => rm(scratch, { recursive: true, force: true }))

test('every variant has an npm manifest named for its package with the shared fields', async () => {
  const { version, description, author, repository } = await readRootManifest()

  for (const variant of VARIANTS) {
    const manifest = await readJson(join(outOf(variant), 'package.json'))

    assert.deepEqual(
      {
        name: manifest.name,
        version: manifest.version,
        description: manifest.description,
        author: manifest.author,
        repository: manifest.repository,
      },
      { name: variant.package, version, description, author, repository },
    )
  }
})

test('the Claude Code plugin manifest keeps the shared plugin name and fields', async () => {
  const { name, version, description, author } = await readRootManifest()
  const variant = byName('claude-code')
  const manifest = await readJson(join(outOf(variant), variant.manifest))

  assert.deepEqual(
    { name: manifest.name, version: manifest.version, description: manifest.description, author: manifest.author },
    { name, version, description, author },
  )
  assert.equal(manifest.repository, undefined)
})

test('every variant holds the shared source and only its own adapter', async () => {
  for (const variant of VARIANTS) {
    assert.deepEqual(await readdir(join(outOf(variant), 'src', 'adapters')), [variant.name])
    assert.deepEqual((await readdir(join(outOf(variant), 'src'))).sort(), ['adapters', 'config', 'core', 'render', 'strategies'])
  }
})

test('no variant ships the adapter manifest template or the dev tsconfig', async () => {
  for (const variant of VARIANTS) {
    const files = await readdir(join(outOf(variant), 'src', 'adapters', variant.name))

    assert.ok(!files.includes('manifest.json'))
    assert.ok(!files.includes('tsconfig.json'))
  }
})

test('the Claude Code manifest names hooks modules and types that exist', async () => {
  const variant = byName('claude-code')
  const out = outOf(variant)
  const manifest = await readJson(join(out, variant.manifest))
  const hooks = join(out, manifest.hooks)
  const { modules } = await readJson(hooks)

  await access(join(out, manifest.types))
  assert.notEqual(modules.length, 0)
  for (const module of modules) await access(join(dirname(hooks), module))
})

test('every Pi extension in the package manifest has an index.ts', async () => {
  const variant = byName('pi')
  const { pi } = await readJson(join(outOf(variant), variant.manifest))

  assert.notEqual(pi.extensions.length, 0)
  for (const extension of pi.extensions) await access(join(outOf(variant), extension, 'index.ts'))
})

test('a rebuild drops source left from the last build', async () => {
  const variant = byName('pi')
  const stale = join(outOf(variant), 'src', 'stale.ts')

  await writeFile(stale, '')
  await buildVariant(variant, outOf(variant))
  await assert.rejects(access(stale))
})

test('a rebuild keeps the types Claude Code generates beside the manifest', async () => {
  const variant = byName('claude-code')
  const types = join(outOf(variant), '.claude-plugin', 'types')

  await mkdir(types, { recursive: true })
  await writeFile(join(types, 'tsconfig.json'), '{}')
  await buildVariant(variant, outOf(variant))
  await access(join(types, 'tsconfig.json'))
})

test('npm manifests hold only package fields and their own template', async () => {
  const claudeCode = byName('claude-code')
  const pi = byName('pi')
  const npmFields = ['name', 'version', 'description', 'author', 'repository']

  assert.deepEqual(Object.keys(await readJson(join(outOf(claudeCode), 'package.json'))), npmFields)
  assert.deepEqual(Object.keys(await readJson(join(outOf(pi), 'package.json'))), [
    ...npmFields,
    'type',
    'keywords',
    'pi',
    'engines',
    'peerDependencies',
  ])
})
