import assert from 'node:assert/strict'
import { test } from 'node:test'

import { gitRepoOf, listPiPackages } from '../scripts/lib/pi-cli.ts'
import { fakeRunner } from './helpers.ts'

const LIST = [
  '\x1b[1mUser packages:\x1b[22m',
  '  npm:pi-effort',
  '\x1b[2m    /home/u/.pi/agent/npm/node_modules/pi-effort\x1b[22m',
  '  git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.1 (filtered)',
  '    /home/u/.pi/agent/git/github.com/fj/jxf-agent-plugins-alpha-pi',
  '  ../../data/pi/beta',
  '    /home/u/data/pi/beta',
  '',
  'Project packages:',
  '  npm:project-only',
  '    /work/.pi/npm/project-only',
].join('\n')

test('pi list is read from the user section', () => {
  const fake = fakeRunner({ 'pi list --no-approve': LIST })
  assert.deepEqual(listPiPackages(fake.run), [
    { source: 'npm:pi-effort', path: '/home/u/.pi/agent/npm/node_modules/pi-effort' },
    { source: 'git:github.com/fj/jxf-agent-plugins-alpha-pi@v0.1.1', path: '/home/u/.pi/agent/git/github.com/fj/jxf-agent-plugins-alpha-pi' },
    { source: '../../data/pi/beta', path: '/home/u/data/pi/beta' },
  ])
})

test('an empty pi list has no packages', () => {
  assert.deepEqual(listPiPackages(fakeRunner({ 'pi list --no-approve': 'No packages installed.' }).run), [])
})

test('git sources of one repo share an identity whatever the form or ref', () => {
  const repo = 'github.com/fj/x'
  for (const source of [
    'git:github.com/fj/x',
    'git:github.com/fj/x@v1.2.3',
    'git:git@github.com:fj/x.git',
    'https://github.com/fj/x',
    'https://github.com/fj/x.git@main',
    'ssh://git@github.com/fj/x',
  ]) {
    assert.equal(gitRepoOf(source), repo, source)
  }
  assert.equal(gitRepoOf('npm:x'), undefined)
  assert.equal(gitRepoOf('../local/x'), undefined)
})
