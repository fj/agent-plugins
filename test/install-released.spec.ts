import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test, type TestContext } from 'node:test'

import type { Harness } from '../scripts/lib/harness.ts'
import { installReleased } from '../scripts/lib/install-released.ts'
import { fakeRunner, gitIn, makeRepo, tempDir } from './helpers.ts'

const DATE = '2026-01-02T03:04:05Z'
const RELEASES = {
  alpha: {
    description: 'Alpha.',
    claude: { repo: 'fj/jxf-agent-plugins-alpha-claude', version: '0.1.2' },
    pi: { repo: 'fj/jxf-agent-plugins-alpha-pi', version: '0.1.2' },
  },
  beta: { description: 'Beta.', pi: { repo: 'fj/jxf-agent-plugins-beta-pi', version: '0.2.3' } },
}

async function setup(t: TestContext, outputs: (dataDir: string) => Record<string, string>) {
  const dir = await tempDir(t)
  const seed = await makeRepo(join(dir, 'seed'), { 'releases.json': JSON.stringify(RELEASES) }, DATE)
  const indexUrl = join(dir, 'index.git')
  gitIn(dir, ['clone', '--quiet', '--bare', seed, indexUrl])
  const dataDir = join(dir, 'data')
  const fake = fakeRunner(outputs(dataDir))
  const install = (harnesses: Harness[]) =>
    installReleased({ indexDir: join(dir, 'index'), indexUrl, owner: 'fj', dataDir, run: fake.run, log: () => {} }, harnesses)
  return { fake, install }
}

test('Claude replaces a jxf marketplace with another source and swaps local plugins for released ones', async (t) => {
  const { fake, install } = await setup(t, () => ({
    'claude plugin marketplace list --json': JSON.stringify([
      { name: 'jxf', source: 'directory', path: '/old/agent-plugins' },
      { name: 'jxf-local', source: 'directory', path: '/data/claude' },
    ]),
    'claude plugin list --json': JSON.stringify([{ id: 'alpha@jxf-local', scope: 'project' }]),
  }))

  await install(['claude'])

  assert.deepEqual(fake.calls, [
    'claude plugin marketplace list --json',
    'claude plugin marketplace remove jxf',
    'claude plugin marketplace add fj/jxf-agent-plugins-index',
    'claude plugin list --json',
    'claude plugin uninstall alpha@jxf-local --keep-data --scope project',
    'claude plugin install alpha@jxf',
  ])
})

test('Claude updates the released marketplace and installed plugins', async (t) => {
  const { fake, install } = await setup(t, () => ({
    'claude plugin marketplace list --json': JSON.stringify([{ name: 'jxf', source: 'github', repo: 'fj/jxf-agent-plugins-index' }]),
    'claude plugin list --json': JSON.stringify([{ id: 'alpha@jxf', scope: 'user' }]),
  }))

  await install(['claude'])

  assert.deepEqual(fake.calls, [
    'claude plugin marketplace list --json',
    'claude plugin marketplace update jxf',
    'claude plugin list --json',
    'claude plugin update alpha@jxf',
  ])
})

test('Pi removes local and other-ref installs, then installs the released tag', async (t) => {
  const { fake, install } = await setup(t, (dataDir) => ({
    'pi list --no-approve': [
      'User packages:',
      '  ../../data/pi/alpha',
      `    ${join(dataDir, 'pi', 'alpha')}`,
      '  git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.1',
      '    /home/u/.pi/agent/git/github.com/fj/jxf-agent-plugins-alpha-pi',
      '  git:github.com/fj/jxf-agent-plugins-beta-pi@v0.2.3',
      '    /home/u/.pi/agent/git/github.com/fj/jxf-agent-plugins-beta-pi',
      '  npm:pi-effort',
      '    /home/u/.pi/agent/npm/node_modules/pi-effort',
    ].join('\n'),
  }))

  await install(['pi'])

  assert.deepEqual(fake.calls, [
    'pi list --no-approve',
    'pi remove ../../data/pi/alpha',
    'pi remove git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.1',
    'pi install git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.2',
  ])
})
