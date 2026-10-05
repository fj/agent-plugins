import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const MANIFEST = join(import.meta.dirname, '../../../src/adapters/claude-code/manifest.json')

test('every config option title starts with the top hat', async () => {
  const { userConfig } = JSON.parse(await readFile(MANIFEST, 'utf8'))

  for (const { title } of Object.values<{ title: string }>(userConfig)) assert.match(title, /^🎩 /)
})
