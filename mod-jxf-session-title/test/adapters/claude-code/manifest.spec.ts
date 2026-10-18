import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

import { DEFAULT_MODEL } from '../../../src/adapters/claude-code/config.ts'
import { DEFAULT_SETTINGS } from '../../../src/config/config.ts'

const MANIFEST = join(import.meta.dirname, '../../../src/adapters/claude-code/manifest.json')

type Option = { title: string; default: unknown }

async function options(): Promise<Record<string, Option>> {
  return JSON.parse(await readFile(MANIFEST, 'utf8')).userConfig
}

test('every option title starts with the top hat', async () => {
  for (const { title } of Object.values(await options())) assert.match(title, /^🎩 /)
})

test('the option defaults match the shared defaults', async () => {
  const { autoTitle, model, ...rest } = await options()
  const { isAutomatic, ...settings } = DEFAULT_SETTINGS

  assert.equal(model?.default, DEFAULT_MODEL)
  assert.equal(autoTitle?.default, isAutomatic)
  assert.deepEqual(Object.fromEntries(Object.entries(rest).map(([key, option]) => [key, option.default])), settings)
})
