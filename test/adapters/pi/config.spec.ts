import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { CONFIG_FILE, readConfig } from '../../../src/adapters/pi/config.ts'

async function withDir(body: (dir: string) => Promise<void>) {
  const dir = await mkdtemp(join(tmpdir(), 'mod-jxf-fancy-config-'))

  try {
    await body(dir)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

test('readConfig parses the config file', () =>
  withDir(async dir => {
    const path = join(dir, CONFIG_FILE)
    await writeFile(path, '{"usageStrategy":"default"}')

    assert.equal(readConfig(path).usageStrategy, 'default')
  }))

test('readConfig falls back to no settings when the file is missing', () =>
  withDir(async dir => {
    assert.deepEqual(readConfig(join(dir, CONFIG_FILE)), {})
  }))

test('readConfig falls back to no settings when the path cannot be read as a file', () =>
  withDir(async dir => {
    assert.deepEqual(readConfig(dir), {})
  }))
