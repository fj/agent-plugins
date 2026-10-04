import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'

const ROOT = join(import.meta.dirname, '../../..')

test('every Pi extension in the package manifest has an index.ts', async () => {
  const manifest = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'))
  const extensions: string[] = manifest.pi.extensions

  assert.notEqual(extensions.length, 0)
  for (const extension of extensions) await access(join(ROOT, extension, 'index.ts'))
})
