import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'

import type { Harness } from '../scripts/lib/harness.ts'
import { discoverPlugins, findPlugin } from '../scripts/lib/manifest.ts'
import { releaseAll, releasePlugin, type ReleaseContext } from '../scripts/lib/release.ts'
import { commitAll, gitIn, makeRepo, manifest, tempDir, writeFiles } from './helpers.ts'

const FIRST_DATE = '2026-01-02T03:04:05Z'
const FIRST = '0.1.20260102030405'
const SECOND_DATE = '2026-02-03T04:05:06Z'
const SECOND = '0.1.20260203040506'

async function setup(t: TestContext, { dryRun = false, emptyIndex = false } = {}) {
  const dir = await tempDir(t)
  const remotes = join(dir, 'remotes')
  const testLog = join(dir, 'tests.log')
  const root = await makeRepo(
    join(dir, 'agent-plugins'),
    {
      'alpha/agent-plugin.json': manifest('alpha', { test: `pwd >> '${testLog}'` }),
      'alpha/commands/hello.md': 'Hello. See {{command:bye}}.\n',
      'alpha/commands/bye.md': 'Bye.\n',
      'broken/agent-plugin.json': manifest('broken', { build: 'exit 1 ;' }),
    },
    FIRST_DATE,
  )
  if (emptyIndex) {
    gitIn(dir, ['init', '--quiet', '--bare', join(remotes, 'jxf-agent-plugins-index.git')])
  } else {
    const seed = await makeRepo(join(dir, 'index-seed'), { 'README.md': 'index\n' }, FIRST_DATE)
    gitIn(dir, ['clone', '--quiet', '--bare', seed, join(remotes, 'jxf-agent-plugins-index.git')])
  }

  const created: string[][] = []
  const ctx: ReleaseContext = {
    root,
    owner: 'fj',
    remoteBase: remotes,
    indexDir: join(dir, 'index'),
    createRepo: (repo, description) => {
      created.push([repo, description])
      gitIn(dir, ['init', '--quiet', '--bare', join(remotes, `${repo}.git`)])
    },
    log: () => {},
    dryRun,
  }
  const release = (harness: Harness, name = 'alpha') => releasePlugin(ctx, findPlugin(discoverPlugins(root), name), harness)
  const remote = (repo: string) => join(remotes, `${repo}.git`)
  const indexFile = async (path: string) => {
    const checkout = join(dir, `index-view-${Date.now()}`)
    gitIn(dir, ['clone', '--quiet', remote('jxf-agent-plugins-index'), checkout])
    const text = await readFile(join(checkout, path), 'utf8')
    await rm(checkout, { recursive: true, force: true })
    return text
  }
  const changeAlpha = async () => {
    await writeFiles(root, { 'alpha/commands/hello.md': 'Hello again.\n' })
    commitAll(root, 'change alpha', SECOND_DATE)
  }
  return { dir, root, ctx, created, release, remote, indexFile, testLog, changeAlpha }
}

test('the first release creates the repo, the submodule and the index entries', async (t) => {
  const { root, created, release, remote, indexFile, testLog } = await setup(t)

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: FIRST, outcome: 'released' })

  assert.deepEqual(created, [
    ['jxf-agent-plugins-alpha-claude', 'alpha for Claude Code, released from fj/agent-plugins. Write-only.'],
  ])
  assert.equal(await readFile(testLog, 'utf8'), `${join(root, 'alpha')}\n`)

  const repo = remote('jxf-agent-plugins-alpha-claude')
  assert.equal(
    gitIn(repo, ['log', '-1', '--format=%B', 'main']),
    `release: alpha ${FIRST}\n\nSource: fj/agent-plugins@${gitIn(root, ['rev-parse', 'HEAD'])}`,
  )
  assert.equal(gitIn(repo, ['cat-file', '-t', `v${FIRST}`]), 'tag')
  assert.equal(gitIn(repo, ['rev-parse', `v${FIRST}^{commit}`]), gitIn(repo, ['rev-parse', 'main']))
  assert.deepEqual(gitIn(repo, ['ls-tree', '-r', '--name-only', 'main']).split('\n'), [
    '.claude-plugin/plugin.json',
    'commands/bye.md',
    'commands/hello.md',
  ])
  assert.equal(gitIn(repo, ['show', 'main:commands/hello.md']), 'Hello. See /alpha:bye.')

  const index = remote('jxf-agent-plugins-index')
  assert.equal(gitIn(index, ['log', '-1', '--format=%s', 'main']), `release: alpha-claude ${FIRST}`)
  assert.equal(
    gitIn(index, ['ls-tree', 'main', 'alpha-claude']),
    `160000 commit ${gitIn(repo, ['rev-parse', 'main'])}\talpha-claude`,
  )
  assert.match(await indexFile('.gitmodules'), /path = alpha-claude\n\turl = .*jxf-agent-plugins-alpha-claude.git/)
  assert.deepEqual(JSON.parse(await indexFile('releases.json')), {
    alpha: { description: 'The alpha plugin.', claude: { repo: 'fj/jxf-agent-plugins-alpha-claude', version: FIRST } },
  })
  assert.deepEqual(JSON.parse(await indexFile('.claude-plugin/marketplace.json')), {
    name: 'jxf',
    owner: { name: 'John Feminella' },
    description: 'Plugins released from fj/agent-plugins.',
    plugins: [
      {
        name: 'alpha',
        description: 'The alpha plugin.',
        version: FIRST,
        source: { source: 'github', repo: 'fj/jxf-agent-plugins-alpha-claude', ref: `v${FIRST}` },
      },
    ],
  })
  const readme = await indexFile('README.md')
  assert.match(readme, new RegExp(`\\| alpha \\| The alpha plugin. \\| ${FIRST} \\| - \\|`))
  assert.match(readme, /claude plugin marketplace add fj\/jxf-agent-plugins-index\nclaude plugin install alpha@jxf\n/)
})

test('releasing the same version again is skipped', async (t) => {
  const { created, release, remote } = await setup(t)
  await release('claude')
  const indexHead = gitIn(remote('jxf-agent-plugins-index'), ['rev-parse', 'main'])

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: FIRST, outcome: 'skipped' })

  assert.equal(created.length, 1)
  assert.equal(gitIn(remote('jxf-agent-plugins-index'), ['rev-parse', 'main']), indexHead)
  assert.equal(gitIn(remote('jxf-agent-plugins-alpha-claude'), ['rev-list', '--count', 'main']), '1')
})

test('a new commit releases a new version that replaces the whole tree', async (t) => {
  const { root, created, release, remote, indexFile } = await setup(t)
  await release('claude')
  await rm(join(root, 'alpha/commands/bye.md'))
  await writeFiles(root, { 'alpha/commands/hello.md': 'Hello again.\n' })
  commitAll(root, 'change alpha', SECOND_DATE)

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: SECOND, outcome: 'released' })

  const repo = remote('jxf-agent-plugins-alpha-claude')
  assert.equal(created.length, 1)
  assert.equal(gitIn(repo, ['rev-list', '--count', 'main']), '2')
  assert.deepEqual(gitIn(repo, ['ls-tree', '-r', '--name-only', `v${SECOND}`]).split('\n'), [
    '.claude-plugin/plugin.json',
    'commands/hello.md',
  ])
  assert.equal(gitIn(repo, ['rev-parse', `v${FIRST}^{commit}`]), gitIn(repo, ['rev-parse', 'main~1']))
  assert.equal(JSON.parse(await indexFile('releases.json')).alpha.claude.version, SECOND)
  assert.equal(
    gitIn(remote('jxf-agent-plugins-index'), ['ls-tree', 'main', 'alpha-claude']).split(/\s/)[2],
    gitIn(repo, ['rev-parse', 'main']),
  )
})

test('each harness has its own repo and only Claude releases enter the marketplace', async (t) => {
  const { release, remote, indexFile } = await setup(t)
  await release('claude')
  await release('pi')

  const pi = remote('jxf-agent-plugins-alpha-pi')
  assert.deepEqual(gitIn(pi, ['ls-tree', '-r', '--name-only', 'main']).split('\n'), [
    'package.json',
    'prompts/alpha-bye.md',
    'prompts/alpha-hello.md',
  ])
  assert.deepEqual(JSON.parse(await indexFile('releases.json')).alpha, {
    description: 'The alpha plugin.',
    claude: { repo: 'fj/jxf-agent-plugins-alpha-claude', version: FIRST },
    pi: { repo: 'fj/jxf-agent-plugins-alpha-pi', version: FIRST },
  })
  const marketplace = JSON.parse(await indexFile('.claude-plugin/marketplace.json'))
  assert.deepEqual(marketplace.plugins.map(({ name }: { name: string }) => name), ['alpha'])
  assert.match(await indexFile('README.md'), new RegExp(`pi install git:github.com/fj/jxf-agent-plugins-alpha-pi@v${FIRST}\n`))
})

test('a dry run builds but creates, commits and pushes nothing', async (t) => {
  const { ctx, created, release, remote } = await setup(t, { dryRun: true })

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: FIRST, outcome: 'dry run' })

  assert.deepEqual(created, [])
  assert.equal(existsSync(ctx.indexDir), false)
  assert.equal(existsSync(remote('jxf-agent-plugins-alpha-claude')), false)
})

test('a dry run still fails when the build fails', async (t) => {
  const { release } = await setup(t, { dryRun: true })
  await assert.rejects(release('claude', 'broken'), /exit code 1/)
})

test('a release needs a clean checkout', async (t) => {
  const { root, release } = await setup(t)
  await writeFiles(root, { 'alpha/commands/new.md': 'new' })
  await assert.rejects(release('claude'), /has uncommitted changes/)
})

test('a release needs the index on main', async (t) => {
  const { ctx, release } = await setup(t)
  await release('claude')
  gitIn(ctx.indexDir, ['checkout', '--quiet', '-b', 'other'])
  await writeFiles(ctx.root, { 'alpha/commands/hello.md': 'changed' })
  commitAll(ctx.root, 'change', SECOND_DATE)
  await assert.rejects(release('claude'), /is on other; switch it to main/)
})

test('a failing test stops the release', async (t) => {
  const { ctx, created, release } = await setup(t)
  await writeFiles(ctx.root, { 'alpha/agent-plugin.json': manifest('alpha', { test: 'exit 2 ;' }) })
  commitAll(ctx.root, 'failing test', SECOND_DATE)
  await assert.rejects(release('claude'), /exit code 2/)
  assert.deepEqual(created, [])
})

test('release:all reports every plugin, even after a failure', async (t) => {
  const { ctx, remote } = await setup(t)

  const results = await releaseAll(ctx, 'claude')

  assert.deepEqual(
    results.map((result) => ('error' in result ? [result.plugin, 'error'] : [result.plugin, result.outcome])),
    [
      ['alpha', 'released'],
      ['broken', 'error'],
    ],
  )
  assert.equal(existsSync(remote('jxf-agent-plugins-alpha-claude')), true)
})

test('a release into a fresh index clone initializes the existing submodule', async (t) => {
  const { ctx, created, release, remote, changeAlpha } = await setup(t)
  await release('claude')
  await rm(ctx.indexDir, { recursive: true, force: true })
  await changeAlpha()

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: SECOND, outcome: 'released' })

  const repo = remote('jxf-agent-plugins-alpha-claude')
  const index = remote('jxf-agent-plugins-index')
  assert.equal(created.length, 1)
  assert.equal(gitIn(repo, ['rev-list', '--count', 'main']), '2')
  assert.equal(gitIn(index, ['ls-tree', 'main', 'alpha-claude']).split(/\s/)[2], gitIn(repo, ['rev-parse', 'main']))
  assert.equal(gitIn(index, ['log', '-1', '--format=%s', 'main']), `release: alpha-claude ${SECOND}`)
})

test('an existing tag in a repo the index does not list yet is skipped without leftovers', async (t) => {
  const { dir, ctx, created, release, remote } = await setup(t)
  await release('claude')
  const index = remote('jxf-agent-plugins-index')
  const view = join(dir, 'rewind')
  gitIn(dir, ['clone', '--quiet', index, view])
  gitIn(view, ['reset', '--quiet', '--hard', 'HEAD~1'])
  gitIn(view, ['push', '--quiet', '--force', 'origin', 'main'])
  const indexHead = gitIn(index, ['rev-parse', 'main'])
  await rm(ctx.indexDir, { recursive: true, force: true })

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: FIRST, outcome: 'skipped' })

  assert.equal(created.length, 1)
  assert.equal(gitIn(ctx.indexDir, ['status', '--porcelain']), '')
  assert.equal(existsSync(join(ctx.indexDir, 'alpha-claude')), false)
  assert.equal(gitIn(index, ['rev-parse', 'main']), indexHead)
})

test('the first release into an empty index starts its main branch', async (t) => {
  const { release, remote, indexFile } = await setup(t, { emptyIndex: true })

  assert.deepEqual(await release('claude'), { plugin: 'alpha', version: FIRST, outcome: 'released' })

  assert.equal(gitIn(remote('jxf-agent-plugins-index'), ['log', '--format=%s', 'main']), `release: alpha-claude ${FIRST}`)
  assert.equal(JSON.parse(await indexFile('releases.json')).alpha.claude.version, FIRST)
})

test('a release pulls index changes made elsewhere first', async (t) => {
  const { dir, release, remote, indexFile, changeAlpha } = await setup(t)
  await release('claude')
  const other = join(dir, 'other-index')
  gitIn(dir, ['clone', '--quiet', remote('jxf-agent-plugins-index'), other])
  await writeFiles(other, { 'notes.md': 'from elsewhere\n' })
  commitAll(other, 'notes', SECOND_DATE)
  gitIn(other, ['push', '--quiet', 'origin', 'main'])
  await changeAlpha()

  await release('claude')

  assert.equal(await indexFile('notes.md'), 'from elsewhere\n')
  assert.equal(gitIn(remote('jxf-agent-plugins-index'), ['log', '-1', '--format=%s', 'main']), `release: alpha-claude ${SECOND}`)
})

test('a release needs a clean index', async (t) => {
  const { ctx, release, changeAlpha } = await setup(t)
  await release('claude')
  await writeFiles(ctx.indexDir, { 'scratch.md': 'local edit' })
  await changeAlpha()
  await assert.rejects(release('claude'), /index has uncommitted changes/)
})
