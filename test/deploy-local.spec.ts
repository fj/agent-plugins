import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'

import { deployLocal } from '../scripts/lib/deploy-local.ts'
import type { Harness } from '../scripts/lib/harness.ts'
import { fakeRunner, makeRepo, manifest, tempDir } from './helpers.ts'

const DATE = '2026-01-02T03:04:05Z'
const VERSION = '0.1.20260102030405'

async function setup(t: TestContext, outputs: (dataDir: string) => Record<string, string>) {
  const dir = await tempDir(t)
  const root = await makeRepo(
    join(dir, 'repo'),
    {
      'alpha/agent-plugin.json': manifest('alpha'),
      'alpha/commands/hello.md': 'Hello.\n',
      'beta/agent-plugin.json': manifest('beta', { harnesses: ['pi'] }),
      'beta/commands/hi.md': 'Hi.\n',
    },
    DATE,
  )
  const dataDir = join(dir, 'data')
  const fake = fakeRunner(outputs(dataDir))
  const logs: string[] = []
  const deploy = (harnesses: Harness[]) => deployLocal({ root, dataDir, owner: 'fj', run: fake.run, log: (l) => logs.push(l) }, harnesses)
  return { dataDir, fake, logs, deploy }
}

test('the first Claude deploy adds the local marketplace and swaps released plugins for local ones', async (t) => {
  const { dataDir, fake, logs, deploy } = await setup(t, () => ({
    'claude plugin marketplace list --json': JSON.stringify([{ name: 'jxf', source: 'github', repo: 'fj/jxf-agent-plugins-index' }]),
    'claude plugin list --json': JSON.stringify([{ id: 'alpha@jxf', scope: 'user' }]),
  }))

  await deploy(['claude'])

  const dir = join(dataDir, 'claude')
  assert.deepEqual(fake.calls, [
    'claude plugin marketplace list --json',
    `claude plugin marketplace add ${dir}`,
    'claude plugin list --json',
    'claude plugin uninstall alpha@jxf --keep-data --scope user',
    'claude plugin install alpha@jxf-local',
  ])
  assert.deepEqual(JSON.parse(await readFile(join(dir, '.claude-plugin/marketplace.json'), 'utf8')), {
    name: 'jxf-local',
    owner: { name: 'John Feminella' },
    description: 'Local builds of fj/agent-plugins.',
    plugins: [{ name: 'alpha', description: 'The alpha plugin.', version: VERSION, source: './alpha' }],
  })
  assert.equal(JSON.parse(await readFile(join(dir, 'alpha/.claude-plugin/plugin.json'), 'utf8')).version, VERSION)
  assert.deepEqual((await readdir(dir)).sort(), ['.claude-plugin', 'alpha'])
  assert.match(logs.at(-1)!, /\/reload-plugins/)
})

test('a later Claude deploy updates the marketplace and the plugins', async (t) => {
  const { fake, deploy } = await setup(t, (dataDir) => ({
    'claude plugin marketplace list --json': JSON.stringify([
      { name: 'jxf-local', source: 'directory', path: join(dataDir, 'claude') },
    ]),
    'claude plugin list --json': JSON.stringify([{ id: 'alpha@jxf-local', scope: 'user' }]),
  }))

  await deploy(['claude'])

  assert.deepEqual(fake.calls, [
    'claude plugin marketplace list --json',
    'claude plugin marketplace update jxf-local',
    'claude plugin list --json',
    'claude plugin update alpha@jxf-local',
  ])
})

test('a local marketplace at another path is replaced', async (t) => {
  const { dataDir, fake, deploy } = await setup(t, () => ({
    'claude plugin marketplace list --json': JSON.stringify([{ name: 'jxf-local', source: 'directory', path: '/elsewhere' }]),
  }))

  await deploy(['claude'])

  assert.deepEqual(fake.calls.slice(0, 3), [
    'claude plugin marketplace list --json',
    'claude plugin marketplace remove jxf-local',
    `claude plugin marketplace add ${join(dataDir, 'claude')}`,
  ])
})

test('the Pi deploy removes released installs and installs each local path once', async (t) => {
  const { dataDir, fake, deploy } = await setup(t, (data) => ({
    'pi list --no-approve': [
      'User packages:',
      '  git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.1',
      '    /home/u/.pi/agent/git/github.com/fj/jxf-agent-plugins-alpha-pi',
      '  git:github.com/fj/jxf-agent-plugins-alphabet-pi',
      '    /home/u/.pi/agent/git/github.com/fj/jxf-agent-plugins-alphabet-pi',
      '  ../../data/pi/beta',
      `    ${join(data, 'pi', 'beta')}`,
    ].join('\n'),
  }))

  await deploy(['pi'])

  assert.deepEqual(fake.calls, [
    'pi list --no-approve',
    'pi remove git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.1',
    `pi install ${join(dataDir, 'pi', 'alpha')}`,
  ])
  assert.deepEqual((await readdir(join(dataDir, 'pi'))).sort(), ['alpha', 'beta'])
  assert.equal(JSON.parse(await readFile(join(dataDir, 'pi/beta/package.json'), 'utf8')).version, VERSION)
})

test('deploying to both harnesses runs both installers', async (t) => {
  const { fake, deploy } = await setup(t, () => ({}))
  await deploy(['claude', 'pi'])
  assert.ok(fake.calls.includes('claude plugin install alpha@jxf-local'))
  assert.ok(fake.calls.some((call) => call.startsWith('pi install ') && call.endsWith('/pi/beta')))
})
