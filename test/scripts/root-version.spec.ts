import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, test } from 'node:test'

import { readVersion, writeVersion } from '../../scripts/root-version.ts'

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'root-version-spec-'))
})

afterEach(() => rm(root, { recursive: true, force: true }))

test('writeVersion changes only the version and keeps the formatting', async () => {
  await writeFile(join(root, 'package.json'), '{\n  "name": "mod",\n  "version": "1.2.3",\n  "author": { "name": "T" }\n}\n')

  await writeVersion('1.3.0', root)

  assert.equal(await readVersion(root), '1.3.0')
  assert.equal(
    await readFile(join(root, 'package.json'), 'utf8'),
    '{\n  "name": "mod",\n  "version": "1.3.0",\n  "author": { "name": "T" }\n}\n',
  )
})

test('writeVersion refuses a manifest with no version field', async () => {
  await writeFile(join(root, 'package.json'), '{ "name": "mod" }\n')

  await assert.rejects(writeVersion('1.3.0', root), /no version field/)
})
