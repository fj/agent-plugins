import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'

import { buildPlugin } from '../scripts/lib/build.ts'
import type { Harness } from '../scripts/lib/harness.ts'
import { discoverPlugins, findPlugin } from '../scripts/lib/manifest.ts'
import { makeRepo, manifest, tempDir, writeFiles } from './helpers.ts'

const DATE = '2026-01-02T03:04:05Z'
const VERSION = '0.1.20260102030405'

const COMMANDS = {
  'demo/commands/coding/pr/make.md': '---\ndescription: Make a PR, then run {{command:coding:pr:review}}.\n---\nRun $ARGUMENTS.\n',
  'demo/commands/coding/pr/review.md': 'Review it. Then see {{command:top}} and {{command:coding:pr:make}}.\n',
  'demo/commands/top.md': 'Top level.\n',
  'demo/commands/notes.txt': 'Not a command.\n',
}

const CUSTOM_BUILD = `
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const arg = (name) => process.argv[process.argv.indexOf(name) + 1]
const out = arg('--out')
const version = process.argv.includes('--broken') ? '0.0.0' : arg('--version')
const manifests = {
  claude: ['.claude-plugin/plugin.json', { name: 'demo', version }],
  pi: ['package.json', process.argv.includes('--bare') ? { name: 'demo', version } : { name: 'demo', version, keywords: ['pi-package'], pi: {} }],
}
const [path, fields] = manifests[arg('--harness')]
mkdirSync(join(out, '.claude-plugin'), { recursive: true })
writeFileSync(join(out, path), JSON.stringify(fields))
writeFileSync(join(out, 'seen.json'), JSON.stringify({ argv: process.argv.slice(2), marker: readFileSync('marker.txt', 'utf8') }))
`

async function setup(t: TestContext, files: Record<string, string>, fields: Record<string, unknown> = {}) {
  const dir = await tempDir(t)
  const root = await makeRepo(join(dir, 'repo'), { 'demo/agent-plugin.json': manifest('demo', fields), ...files }, DATE)
  const out = join(dir, "out dir's")
  const build = (harness: Harness) =>
    buildPlugin({ root, plugin: findPlugin(discoverPlugins(root), 'demo'), harness, version: VERSION, out })
  return { root, out, build }
}

const readText = (path: string) => readFile(path, 'utf8')
const readJsonFile = async (path: string) => JSON.parse(await readText(path))

test('the generic Claude build keeps the command tree and renders references', async (t) => {
  const { out, build } = await setup(t, COMMANDS)
  await build('claude')

  assert.deepEqual(await readJsonFile(join(out, '.claude-plugin/plugin.json')), {
    name: 'demo',
    version: VERSION,
    description: 'The demo plugin.',
    author: { name: 'Test Author' },
  })
  assert.deepEqual((await readdir(join(out, 'commands'), { recursive: true })).sort(), [
    'coding',
    'coding/pr',
    'coding/pr/make.md',
    'coding/pr/review.md',
    'top.md',
  ])
  assert.equal(
    await readText(join(out, 'commands/coding/pr/make.md')),
    '---\ndescription: Make a PR, then run /demo:coding:pr:review.\n---\nRun $ARGUMENTS.\n',
  )
  assert.equal(
    await readText(join(out, 'commands/coding/pr/review.md')),
    'Review it. Then see /demo:top and /demo:coding:pr:make.\n',
  )
})

test('the generic Pi build flattens prompts and renders references', async (t) => {
  const { out, build } = await setup(t, COMMANDS)
  await build('pi')

  assert.deepEqual(await readJsonFile(join(out, 'package.json')), {
    name: 'demo',
    version: VERSION,
    description: 'The demo plugin.',
    author: { name: 'Test Author' },
    keywords: ['pi-package'],
    pi: { prompts: ['./prompts'] },
  })
  assert.deepEqual((await readdir(out)).sort(), ['package.json', 'prompts'])
  assert.deepEqual((await readdir(join(out, 'prompts'))).sort(), [
    'demo-coding-pr-make.md',
    'demo-coding-pr-review.md',
    'demo-top.md',
  ])
  assert.equal(
    await readText(join(out, 'prompts/demo-coding-pr-make.md')),
    '---\ndescription: Make a PR, then run /demo-coding-pr-review.\n---\nRun $ARGUMENTS.\n',
  )
  assert.equal(await readText(join(out, 'prompts/demo-coding-pr-review.md')), 'Review it. Then see /demo-top and /demo-coding-pr-make.\n')
})

test('an unknown reference fails the build', async (t) => {
  const { build } = await setup(t, { ...COMMANDS, 'demo/commands/bad.md': 'See {{command:coding:missing}}.' })
  for (const harness of ['claude', 'pi'] as const) {
    await assert.rejects(build(harness), /commands\/bad.md refers to an unknown command: \{\{command:coding:missing\}\}/)
  }
})

test('two commands with the same Pi name fail the Pi build only', async (t) => {
  const { build } = await setup(t, { 'demo/commands/a-b.md': 'one', 'demo/commands/a/b.md': 'two' })
  await assert.rejects(build('pi'), /commands\/a-b.md and commands\/a\/b.md both become prompts\/demo-a-b.md/)
  await build('claude')
})

test('a plugin without commands or a build fails', async (t) => {
  const { build } = await setup(t, { 'demo/README.md': 'nothing here' })
  await assert.rejects(build('claude'), /no commands\/\*\*\/\*.md files/)
})

test('the build uses the committed state, not the working tree', async (t) => {
  const { root, out, build } = await setup(t, COMMANDS)
  await writeFiles(root, { 'demo/commands/top.md': 'uncommitted', 'demo/commands/new.md': 'uncommitted' })
  await build('claude')

  assert.equal(await readText(join(out, 'commands/top.md')), 'Top level.\n')
  assert.deepEqual((await readdir(join(out, 'commands'))).sort(), ['coding', 'top.md'])
})

test('a custom build runs in the exported plugin with harness, out and version', async (t) => {
  const { out, build } = await setup(
    t,
    { 'demo/build.mjs': CUSTOM_BUILD, 'demo/marker.txt': 'exported' },
    { build: 'node build.mjs' },
  )
  for (const harness of ['claude', 'pi'] as const) {
    await build(harness)
    assert.deepEqual(await readJsonFile(join(out, 'seen.json')), {
      argv: ['--harness', harness, '--out', out, '--version', VERSION],
      marker: 'exported',
    })
  }
})

test('the build replaces the previous output', async (t) => {
  const { out, build } = await setup(t, COMMANDS)
  await writeFiles(out, { 'stale.txt': 'old' })
  await build('pi')
  assert.deepEqual((await readdir(out)).sort(), ['package.json', 'prompts'])
})

test('a build with a wrong native manifest fails validation', async (t) => {
  const { build } = await setup(
    t,
    { 'demo/build.mjs': CUSTOM_BUILD, 'demo/marker.txt': '' },
    { build: 'node build.mjs --broken' },
  )
  await assert.rejects(build('claude'), /\.claude-plugin\/plugin.json is invalid:\n {2}- version must be 0.1.20260102030405/)
})

test('a Pi build without the pi-package keyword or pi field fails validation', async (t) => {
  const { build } = await setup(t, { 'demo/build.mjs': CUSTOM_BUILD, 'demo/marker.txt': '' }, { build: 'node build.mjs --bare' })
  await assert.rejects(build('pi'), (error: Error) =>
    ['keywords must contain pi-package', 'a pi field is required'].every((p) => error.message.includes(p)),
  )
})

test('a build without the native manifest fails validation', async (t) => {
  const { build } = await setup(t, {}, { build: 'true' })
  await assert.rejects(build('claude'), /the claude build has no readable .claude-plugin\/plugin.json/)
})

test('a failing custom build fails', async (t) => {
  const { build } = await setup(t, {}, { build: 'exit 3 ;' })
  await assert.rejects(build('claude'), /exit code 3/)
})

test('a harness the plugin does not support is refused', async (t) => {
  const { build } = await setup(t, COMMANDS, { harnesses: ['pi'] })
  await assert.rejects(build('claude'), /demo does not support claude/)
})
