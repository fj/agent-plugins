import assert from 'node:assert/strict'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { defaultTarget, MARKETPLACE, publishLocally, type Run } from '../../scripts/local-publish.ts'
import { commitTime } from '../../scripts/git.ts'
import { readRootManifest, ROOT } from '../../scripts/root-manifest.ts'
import { stamped } from '../../scripts/version.ts'

const LOCAL_ID = `mod-jxf-fancy-details@${MARKETPLACE}`
const OLD_LOCAL_ID = 'mod-jxf-fancy-details@mod-jxf-fancy-details-local'

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
  marketplaces: ['claude-plugins-official', MARKETPLACE],
  plugins: ['jxf@jxf', OLD_LOCAL_ID, 'mod-jxf-fancy-details-extra@jxf', 'rust-analyzer-lsp@claude-plugins-official'],
  piSources: ['npm:pi-effort', 'git:github.com/fj/mod-jxf-fancy-details', 'npm:mod-jxf-fancy-details-pi@0.3.0', 'https://github.com/fj/mod-jxf-fancy-details'],
}

test('a first local publish swaps other installs for the jxf marketplace build', async () => {
  await publishLocally(target, fakeRun(FRESH))

  assert.deepEqual(calls, [
    `claude plugin uninstall ${OLD_LOCAL_ID} --keep-data`,
    `claude plugin install ${LOCAL_ID}`,
    'pi remove git:github.com/fj/mod-jxf-fancy-details',
    'pi remove npm:mod-jxf-fancy-details-pi@0.3.0',
    'pi remove https://github.com/fj/mod-jxf-fancy-details',
    `pi install ${join(target, 'pi')}`,
  ])
})

test('a repeat local publish updates the local installs and touches nothing else', async () => {
  const machine: Machine = {
    marketplaces: [MARKETPLACE],
    plugins: ['jxf@jxf', LOCAL_ID],
    piSources: ['npm:pi-effort', '/repo/dist/pi'],
  }

  await publishLocally(target, fakeRun(machine))

  assert.deepEqual(calls, [`claude plugin update ${LOCAL_ID}`, `pi install ${join(target, 'pi')}`])
})

test('the target holds both builds and no marketplace of its own', async () => {
  await publishLocally(target, fakeRun(FRESH))

  await assert.rejects(access(join(target, '.claude-plugin')))
  await access(join(target, 'claude-code', '.claude-plugin', 'plugin.json'))
  await access(join(target, 'pi', 'package.json'))
})

test('both builds carry major and minor from the root and the publish time in UTC as patch', async () => {
  await publishLocally(target, fakeRun(FRESH), undefined, new Date('2026-09-15T23:30:00-05:00'))

  const [major, minor] = ((await readRootManifest()).version as string).split('.')
  const expected = `${major}.${minor}.20260916043000`
  assert.equal(JSON.parse(await readFile(join(target, 'claude-code', '.claude-plugin', 'plugin.json'), 'utf8')).version, expected)
  assert.equal(JSON.parse(await readFile(join(target, 'pi', 'package.json'), 'utf8')).version, expected)
})

test('the default target is the dist directory the jxf marketplace points at', () => {
  assert.equal(defaultTarget('/repo'), '/repo/dist')
})

test('a missing jxf marketplace stops the publish before any build or install', async () => {
  const machine: Machine = { marketplaces: ['claude-plugins-official'], plugins: [OLD_LOCAL_ID], piSources: [] }

  await assert.rejects(publishLocally(target, fakeRun(machine)), /register the jxf marketplace/)
  assert.deepEqual(calls, [])
  await assert.rejects(access(join(target, 'claude-code')))
})

test('a jxf install next to another install still removes the other one', async () => {
  const machine: Machine = { marketplaces: [MARKETPLACE], plugins: [OLD_LOCAL_ID, LOCAL_ID], piSources: [] }

  await publishLocally(target, fakeRun(machine))

  assert.deepEqual(calls.slice(0, 2), [`claude plugin uninstall ${OLD_LOCAL_ID} --keep-data`, `claude plugin update ${LOCAL_ID}`])
})

test('a registered jxf marketplace without the plugin installs it', async () => {
  const machine: Machine = { marketplaces: [MARKETPLACE], plugins: [], piSources: [] }

  await publishLocally(target, fakeRun(machine))

  assert.deepEqual(calls.slice(0, 1), [`claude plugin install ${LOCAL_ID}`])
})

test('a failed build runs no claude or pi command', async () => {
  const root = join(target, 'broken')
  await mkdir(root)
  await writeFile(join(root, 'package.json'), '{ "name": "mod-jxf-fancy-details", "version": "1.0.0" }\n')

  await assert.rejects(publishLocally(join(target, 'out'), fakeRun(FRESH), root, new Date()))
  assert.deepEqual(calls, [])
})

test('a local publish reports the version it installed', async () => {
  const version = await publishLocally(target, fakeRun(FRESH))

  const plugin = JSON.parse(await readFile(join(target, 'claude-code', '.claude-plugin', 'plugin.json'), 'utf8'))
  const expected = stamped((await readRootManifest()).version as string, commitTime(ROOT))
  assert.match(version, /^\d+\.\d+\.\d{14}$/)
  assert.equal(version, expected)
  assert.equal(plugin.version, expected)
})
