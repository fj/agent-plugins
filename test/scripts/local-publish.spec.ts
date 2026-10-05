import assert from 'node:assert/strict'
import { access, cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { defaultTarget, MARKETPLACE, publishLocally, type Run } from '../../scripts/local-publish.ts'
import { git } from '../../scripts/git.ts'
import { readRootManifest, ROOT } from '../../scripts/root-manifest.ts'

const LOCAL_ID = `mod-jxf-fancy-details@${MARKETPLACE}`
const OLD_LOCAL_ID = 'mod-jxf-fancy-details@mod-jxf-fancy-details-local'

type Machine = { marketplaces: string[]; plugins: string[]; piSources: string[] }

const SOURCE_TIME = '2026-09-15T12:34:56Z'
const STAMP = '20260915123456'

let scratch: string
let root: string
let target: string
let calls: string[]

beforeEach(async () => {
  scratch = await mkdtemp(join(tmpdir(), 'local-publish-spec-'))
  root = join(scratch, 'repo')
  target = defaultTarget(root)
  calls = []
  await cp(join(ROOT, 'package.json'), join(root, 'package.json'))
  await cp(join(ROOT, 'src'), join(root, 'src'), { recursive: true })
  git(scratch, ['init', '--quiet', root])
  git(root, ['add', '.'])
  git(root, ['-c', 'user.name=Tester', '-c', 'user.email=tester@example.com', 'commit', '--quiet', '-m', 'source'], {
    ...process.env,
    GIT_COMMITTER_DATE: SOURCE_TIME,
  })
})

afterEach(() => rm(scratch, { recursive: true, force: true }))

const publish = (run: Run, time?: Date) => publishLocally(run, { root, time })

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
  await publish(fakeRun(FRESH))

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

  await publish(fakeRun(machine))

  assert.deepEqual(calls, [`claude plugin update ${LOCAL_ID}`, `pi install ${join(target, 'pi')}`])
})

test('the target holds both builds and no marketplace of its own', async () => {
  await publish(fakeRun(FRESH))

  await assert.rejects(access(join(target, '.claude-plugin')))
  await access(join(target, 'claude-code', '.claude-plugin', 'plugin.json'))
  await access(join(target, 'pi', 'package.json'))
})

test('both builds carry major and minor from the root and the publish time in UTC as patch', async () => {
  await publish(fakeRun(FRESH), new Date('2026-09-15T23:30:00-05:00'))

  const [major, minor] = ((await readRootManifest(root)).version as string).split('.')
  const expected = `${major}.${minor}.20260916043000`
  assert.equal(JSON.parse(await readFile(join(target, 'claude-code', '.claude-plugin', 'plugin.json'), 'utf8')).version, expected)
  assert.equal(JSON.parse(await readFile(join(target, 'pi', 'package.json'), 'utf8')).version, expected)
})

test('the default target is the dist directory the jxf marketplace points at', () => {
  assert.equal(defaultTarget('/repo'), '/repo/dist')
})

test('a missing jxf marketplace stops the publish before any build or install', async () => {
  const machine: Machine = { marketplaces: ['claude-plugins-official'], plugins: [OLD_LOCAL_ID], piSources: [] }

  await assert.rejects(publish(fakeRun(machine)), /register the jxf marketplace/)
  assert.deepEqual(calls, [])
  await assert.rejects(access(join(target, 'claude-code')))
})

test('a jxf install next to another install still removes the other one', async () => {
  const machine: Machine = { marketplaces: [MARKETPLACE], plugins: [OLD_LOCAL_ID, LOCAL_ID], piSources: [] }

  await publish(fakeRun(machine))

  assert.deepEqual(calls.slice(0, 2), [`claude plugin uninstall ${OLD_LOCAL_ID} --keep-data`, `claude plugin update ${LOCAL_ID}`])
})

test('a registered jxf marketplace without the plugin installs it', async () => {
  const machine: Machine = { marketplaces: [MARKETPLACE], plugins: [], piSources: [] }

  await publish(fakeRun(machine))

  assert.deepEqual(calls.slice(0, 1), [`claude plugin install ${LOCAL_ID}`])
})

test('a failed build runs no claude or pi command', async () => {
  const broken = join(scratch, 'broken')
  await mkdir(broken)
  await writeFile(join(broken, 'package.json'), '{ "name": "mod-jxf-fancy-details", "version": "1.0.0" }\n')

  await assert.rejects(publishLocally(fakeRun(FRESH), { root: broken, time: new Date() }))
  assert.deepEqual(calls, [])
})

test('a local publish stamps and reports the HEAD commit time by default', async () => {
  const version = await publish(fakeRun(FRESH))

  const plugin = JSON.parse(await readFile(join(target, 'claude-code', '.claude-plugin', 'plugin.json'), 'utf8'))
  const [major, minor] = ((await readRootManifest(root)).version as string).split('.')
  const expected = `${major}.${minor}.${STAMP}`
  assert.equal(version, expected)
  assert.equal(plugin.version, expected)
})
