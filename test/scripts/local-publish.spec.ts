import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { defaultTarget, LOCAL_MARKETPLACE, publishLocally, type Run } from '../../scripts/local-publish.ts'

const LOCAL_ID = `mod-jxf-fancy@${LOCAL_MARKETPLACE}`

type Machine = { marketplaces: string[]; plugins: string[]; piSources: string[] }

let target: string
let calls: string[]

beforeEach(async () => {
  target = await mkdtemp(join(tmpdir(), 'local-publish-spec-'))
  calls = []
})

afterEach(() => rm(target, { recursive: true, force: true }))

const fakeRun =
  ({ marketplaces, plugins, piSources }: Machine): Run =>
  (command, args) => {
    const line = `${command} ${args.join(' ')}`
    if (line === 'claude plugin marketplace list --json') return JSON.stringify(marketplaces.map((name) => ({ name })))
    if (line === 'claude plugin list --json') return JSON.stringify(plugins.map((id) => ({ id })))
    if (line === 'pi list --no-approve') return ['User packages:', ...piSources.flatMap((s) => [`  ${s}`, `    /resolved/${s}`])].join('\n')
    calls.push(line)
    return ''
  }

const FRESH: Machine = {
  marketplaces: ['claude-plugins-official', 'jxf'],
  plugins: ['jxf@jxf', 'mod-jxf-fancy@jxf', 'mod-jxf-fancy-extra@jxf', 'rust-analyzer-lsp@claude-plugins-official'],
  piSources: ['npm:pi-effort', 'git:github.com/fj/mod-jxf-fancy', 'npm:mod-jxf-fancy-pi@0.3.0', 'https://github.com/fj/mod-jxf-fancy'],
}

test('a first local publish swaps the published installs for the local build', async () => {
  await publishLocally(target, fakeRun(FRESH))

  assert.deepEqual(calls, [
    `claude plugin marketplace add ${target}`,
    'claude plugin uninstall mod-jxf-fancy@jxf --keep-data',
    `claude plugin install ${LOCAL_ID}`,
    'pi remove git:github.com/fj/mod-jxf-fancy',
    'pi remove npm:mod-jxf-fancy-pi@0.3.0',
    'pi remove https://github.com/fj/mod-jxf-fancy',
    `pi install ${join(target, 'pi')}`,
  ])
})

test('a repeat local publish updates the local installs and touches nothing else', async () => {
  const machine: Machine = {
    marketplaces: ['jxf', LOCAL_MARKETPLACE],
    plugins: ['jxf@jxf', LOCAL_ID],
    piSources: ['npm:pi-effort', '../../.local/share/mod-jxf-fancy/pi'],
  }

  await publishLocally(target, fakeRun(machine))

  assert.deepEqual(calls, [`claude plugin update ${LOCAL_ID}`, `pi install ${join(target, 'pi')}`])
})

test('the target holds both builds and a marketplace that points at the Claude Code build', async () => {
  await publishLocally(target, fakeRun(FRESH))

  const marketplace = JSON.parse(await readFile(join(target, '.claude-plugin', 'marketplace.json'), 'utf8'))
  assert.equal(marketplace.name, LOCAL_MARKETPLACE)
  assert.deepEqual(
    marketplace.plugins.map(({ name, source }: { name: string; source: string }) => ({ name, source })),
    [{ name: 'mod-jxf-fancy', source: './claude-code' }],
  )
  await access(join(target, 'claude-code', '.claude-plugin', 'plugin.json'))
  await access(join(target, 'pi', 'package.json'))
})

test('the default target follows XDG_DATA_HOME and falls back to ~/.local/share', () => {
  assert.equal(defaultTarget({ XDG_DATA_HOME: '/data' }), '/data/mod-jxf-fancy')
  assert.match(defaultTarget({}), /\/\.local\/share\/mod-jxf-fancy$/)
})

test('a local install next to a published one still removes the published one', async () => {
  const machine: Machine = { marketplaces: [LOCAL_MARKETPLACE], plugins: ['mod-jxf-fancy@jxf', LOCAL_ID], piSources: [] }

  await publishLocally(target, fakeRun(machine))

  assert.deepEqual(calls.slice(0, 2), ['claude plugin uninstall mod-jxf-fancy@jxf --keep-data', `claude plugin update ${LOCAL_ID}`])
})

test('a registered local marketplace without the plugin installs it', async () => {
  const machine: Machine = { marketplaces: [LOCAL_MARKETPLACE], plugins: [], piSources: [] }

  await publishLocally(target, fakeRun(machine))

  assert.deepEqual(calls.slice(0, 1), [`claude plugin install ${LOCAL_ID}`])
})

test('a failed build runs no claude or pi command', async () => {
  const root = join(target, 'broken')
  await mkdir(root)
  await writeFile(join(root, 'package.json'), '{ "name": "mod-jxf-fancy", "version": "1.0.0" }\n')

  await assert.rejects(publishLocally(join(target, 'out'), fakeRun(FRESH), root))
  assert.deepEqual(calls, [])
})
