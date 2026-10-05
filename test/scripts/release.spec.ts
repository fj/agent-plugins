import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { git } from '../../scripts/git.ts'
import { release } from '../../scripts/release.ts'

const ROOT_MANIFEST = { name: 'mod', version: '1.2.3', description: 'A mod.', author: { name: 'Tester' } }
const FILES: Record<string, string> = {
  'package.json': `${JSON.stringify(ROOT_MANIFEST, null, 2)}\n`,
  'src/core/shared.ts': 'export const shared = 1\n',
  'src/adapters/claude-code/manifest.json': '{ "hooks": "./src/adapters/claude-code/hooks.json" }\n',
  'src/adapters/claude-code/hooks.json': '{ "modules": [] }\n',
  'src/adapters/pi/manifest.json': '{ "pi": { "extensions": ["./src/adapters/pi"] } }\n',
  'src/adapters/pi/index.ts': 'export default {}\n',
}

const RELEASE_BRANCHES = ['release/claude-code', 'release/pi']

let scratch: string
let root: string
let remote: string
let verified: number

const verify = () => void verified++
const shown = (rev: string, path: string) => JSON.parse(git(root, ['show', `${rev}:${path}`]))
const filesOf = (rev: string) => git(root, ['ls-tree', '-r', '--name-only', rev]).split('\n')
const releaseBranches = () => git(root, ['branch', '--list', 'release/*'])

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'release-spec-'))
  root = join(scratch, 'repo')
  remote = join(scratch, 'remote.git')
  verified = 0
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
  release({ root, requested, dryRun, verify, ...options })

test('a release commits each built variant to its own release branch', async () => {
  assert.equal(await run('minor'), '1.3.0')

  assert.equal(verified, 1)
  assert.equal(shown('release/claude-code', '.claude-plugin/plugin.json').version, '1.3.0')
  assert.deepEqual(filesOf('release/claude-code'), ['.claude-plugin/plugin.json', 'package.json', 'src/adapters/claude-code/hooks.json', 'src/core/shared.ts'])
  assert.deepEqual(shown('release/pi', 'package.json'), {
    name: 'mod-jxf-fancy-details-pi',
    version: '1.3.0',
    description: 'A mod.',
    author: { name: 'Tester' },
    pi: { extensions: ['./src/adapters/pi'] },
  })
  assert.deepEqual(filesOf('release/pi'), ['package.json', 'src/adapters/pi/index.ts', 'src/core/shared.ts'])
  assert.equal(git(root, ['log', '-1', '--format=%s', 'release/pi']), 'chore: release 1.3.0')
})

test('a release commits the version, tags it and pushes main, the tag and the release branches', async () => {
  await run('2.0.0')

  assert.equal(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version, '2.0.0')
  assert.equal(git(root, ['log', '-1', '--format=%s', 'main']), 'chore: release 2.0.0')
  assert.equal(git(root, ['rev-parse', 'v2.0.0^{commit}']), git(root, ['rev-parse', 'main']))
  assert.notEqual(git(root, ['ls-remote', '--tags', 'origin', 'v2.0.0']), '')
  for (const branch of ['main', ...RELEASE_BRANCHES]) {
    assert.equal(git(root, ['ls-remote', 'origin', branch]).split('\t')[0], git(root, ['rev-parse', branch]))
  }
})

test('a release builds on the previous release of its branch', async () => {
  await run('patch')
  const previous = RELEASE_BRANCHES.map((branch) => git(root, ['rev-parse', branch]))
  await run('patch')

  assert.deepEqual(RELEASE_BRANCHES.map((branch) => git(root, ['rev-parse', `${branch}^`])), previous)
  assert.equal(shown('release/pi', 'package.json').version, '1.2.5')
})

test('a release builds on a release branch that only the remote has', async () => {
  await run('patch')
  const previous = git(root, ['rev-parse', 'release/pi'])
  git(root, ['branch', '--quiet', '-D', ...RELEASE_BRANCHES])
  await run('patch')

  assert.equal(git(root, ['rev-parse', 'release/pi^']), previous)
})

test('a dry run builds every variant and leaves the repo and remote as they were', async () => {
  const head = git(root, ['rev-parse', 'HEAD'])

  assert.equal(await run('patch', true), '1.2.4')
  assert.equal(git(root, ['rev-parse', 'HEAD']), head)
  assert.equal(git(root, ['status', '--porcelain']), '')
  assert.equal(git(root, ['tag']), '')
  assert.equal(releaseBranches(), '')
  assert.equal(git(root, ['ls-remote', 'origin']), '')
})

test('a failed build stops before the version is committed', async () => {
  await writeFile(join(root, 'src/adapters/pi/manifest.json'), 'not json\n')
  git(root, ['commit', '--quiet', '--all', '-m', 'break the pi manifest'])
  const head = git(root, ['rev-parse', 'HEAD'])

  await assert.rejects(run('patch'), SyntaxError)
  assert.equal(git(root, ['rev-parse', 'HEAD']), head)
  assert.equal(git(root, ['status', '--porcelain']), '')
  assert.equal(git(root, ['tag']), '')
  assert.equal(releaseBranches(), '')
})

test('a release refuses uncommitted changes before it verifies or builds', async () => {
  await writeFile(join(root, 'src/core/shared.ts'), 'export const shared = 2\n')

  await assert.rejects(run('patch'), /commit or stash/)
  assert.equal(verified, 0)
  assert.equal(releaseBranches(), '')
})

test('a release refuses a branch other than main', async () => {
  git(root, ['switch', '--quiet', '-c', 'topic/x'])

  await assert.rejects(run('patch'), /release from main/)
  assert.equal(verified, 0)
})

test('a failed verification commits and pushes nothing', async () => {
  const failing = () => {
    throw new Error('tests failed')
  }

  await assert.rejects(run('patch', false, { verify: failing }), /tests failed/)
  assert.equal(git(root, ['tag']), '')
  assert.equal(releaseBranches(), '')
  assert.equal(git(root, ['ls-remote', 'origin']), '')
})
