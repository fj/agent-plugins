import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { git } from '../../scripts/git.ts'
import { release, type Publish } from '../../scripts/release.ts'

const ROOT_MANIFEST = { name: 'mod', version: '1.2.3', description: 'A mod.', author: { name: 'Tester' } }
const FILES: Record<string, string> = {
  'package.json': `${JSON.stringify(ROOT_MANIFEST, null, 2)}\n`,
  'src/core/shared.ts': 'export const shared = 1\n',
  'src/adapters/claude-code/manifest.json': '{ "hooks": "./src/adapters/claude-code/hooks.json" }\n',
  'src/adapters/claude-code/hooks.json': '{ "modules": [] }\n',
  'src/adapters/pi/manifest.json': '{ "pi": { "extensions": ["./src/adapters/pi"] } }\n',
  'src/adapters/pi/index.ts': 'export default {}\n',
}

type Published = { name: string; version: string; dryRun: boolean; plugin?: string }

let scratch: string
let root: string
let remote: string
let verified: number
let published: Published[]

const verify = () => void verified++
const publish: Publish = (dir, dryRun) => {
  const { name, version } = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const plugin = tryRead(join(dir, '.claude-plugin', 'plugin.json'))
  published.push({ name, version, dryRun, ...(plugin && { plugin: JSON.parse(plugin).version }) })
}

const tryRead = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : undefined)

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'release-spec-'))
  root = join(scratch, 'repo')
  remote = join(scratch, 'remote.git')
  verified = 0
  published = []
  git(scratch, ['init', '--quiet', '--bare', remote])
  git(scratch, ['init', '--quiet', '--initial-branch', 'main', root])
  git(root, ['config', 'user.name', 'Tester'])
  git(root, ['config', 'user.email', 'tester@example.com'])
  git(root, ['remote', 'add', 'origin', remote])
  for (const [path, text] of Object.entries(FILES)) {
    await mkdir(join(root, path, '..'), { recursive: true })
    await writeFile(join(root, path), text)
  }
  git(root, ['add', '.'])
  git(root, ['commit', '--quiet', '-m', 'source'])
})

afterEach(() => rm(scratch, { recursive: true, force: true }))

const run = (requested: string, dryRun = false, options: Partial<Parameters<typeof release>[0]> = {}) =>
  release({ root, requested, dryRun, verify, publish, ...options })

test('a release verifies, then dry-runs every package before it publishes any', async () => {
  assert.equal(await run('minor'), '1.3.0')

  assert.equal(verified, 1)
  assert.deepEqual(published, [
    { name: 'mod-jxf-fancy-claude-code', version: '1.3.0', dryRun: true, plugin: '1.3.0' },
    { name: 'mod-jxf-fancy-pi', version: '1.3.0', dryRun: true },
    { name: 'mod-jxf-fancy-claude-code', version: '1.3.0', dryRun: false, plugin: '1.3.0' },
    { name: 'mod-jxf-fancy-pi', version: '1.3.0', dryRun: false },
  ])
})

test('a release commits the version, tags it and pushes main and the tag', async () => {
  await run('2.0.0')

  assert.equal(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version, '2.0.0')
  assert.equal(git(root, ['log', '-1', '--format=%s', 'main']), 'chore: release 2.0.0')
  assert.equal(git(root, ['rev-parse', 'v2.0.0^{commit}']), git(root, ['rev-parse', 'main']))
  assert.equal(git(root, ['ls-remote', 'origin', 'main']).split('\t')[0], git(root, ['rev-parse', 'main']))
  assert.notEqual(git(root, ['ls-remote', '--tags', 'origin', 'v2.0.0']), '')
})

test('a dry run publishes nothing and leaves the repo and remote as they were', async () => {
  const head = git(root, ['rev-parse', 'HEAD'])

  assert.equal(await run('patch', true), '1.2.4')
  assert.ok(published.every(({ dryRun }) => dryRun))
  assert.equal(git(root, ['rev-parse', 'HEAD']), head)
  assert.equal(git(root, ['status', '--porcelain']), '')
  assert.equal(git(root, ['tag']), '')
  assert.equal(git(root, ['ls-remote', 'origin']), '')
})

test('a failed dry-run publish stops before the version is committed', async () => {
  const failing: Publish = (dir, dryRun) => {
    if (dryRun && dir.endsWith('pi')) throw new Error('npm refused')
  }

  await assert.rejects(run('patch', false, { publish: failing }), /npm refused/)
  assert.equal(git(root, ['status', '--porcelain']), '')
  assert.equal(git(root, ['tag']), '')
})

test('a release refuses uncommitted changes before it verifies or publishes', async () => {
  await writeFile(join(root, 'src/core/shared.ts'), 'export const shared = 2\n')

  await assert.rejects(run('patch'), /commit or stash/)
  assert.equal(verified, 0)
  assert.deepEqual(published, [])
})

test('a release refuses a branch other than main', async () => {
  git(root, ['switch', '--quiet', '-c', 'topic/x'])

  await assert.rejects(run('patch'), /release from main/)
  assert.equal(verified, 0)
})

test('a failed verification publishes nothing', async () => {
  const failing = () => {
    throw new Error('tests failed')
  }

  await assert.rejects(run('patch', false, { verify: failing }), /tests failed/)
  assert.deepEqual(published, [])
  assert.equal(git(root, ['tag']), '')
})

test('a failed publish pushes nothing', async () => {
  const failing: Publish = (dir, dryRun) => {
    if (!dryRun && dir.endsWith('pi')) throw new Error('npm refused')
  }

  await assert.rejects(run('patch', false, { publish: failing }), /npm refused/)
  assert.equal(git(root, ['ls-remote', 'origin']), '')
})
