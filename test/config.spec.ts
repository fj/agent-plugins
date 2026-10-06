import assert from 'node:assert/strict'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { settings } from '../scripts/lib/config.ts'

test('settings default to a sibling index and the XDG data dir', () => {
  assert.deepEqual(settings({}, '/src/agent-plugins'), {
    root: '/src/agent-plugins',
    owner: 'fj',
    remoteBase: 'git@github.com:fj',
    indexDir: '/src/jxf-agent-plugins-index',
    dataDir: join(homedir(), '.local/share/jxf-agent-plugins'),
  })
})

test('the environment overrides the index and data dirs', () => {
  const { indexDir, dataDir } = settings({ JXF_AGENT_PLUGINS_INDEX: '/elsewhere/index', XDG_DATA_HOME: '/data' }, '/src/agent-plugins')
  assert.equal(indexDir, '/elsewhere/index')
  assert.equal(dataDir, '/data/jxf-agent-plugins')
})
