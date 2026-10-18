import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sidecarPath, sidecarStore, type Files } from '../../src/core/sidecar.ts'

const RECORD = { title: 'Fix auth refresh', model: 'anthropic/haiku', generatedAt: '2026-10-18T04:00:00.000Z' }

function memoryFiles(initial: Record<string, string> = {}): Files & { all: Map<string, string> } {
  const all = new Map(Object.entries(initial))

  return {
    all,
    read: async path => {
      const text = all.get(path)

      if (text === undefined) {
        throw new Error(`ENOENT: ${path}`)
      }

      return text
    },
    write: async (path, text) => void all.set(path, text),
  }
}

test('the sidecar sits beside the session and does not end in .jsonl', () => {
  assert.equal(sidecarPath('/s/2026_abc.jsonl'), '/s/2026_abc.session-title.json')
  assert.equal(sidecarPath('/s/abc'), '/s/abc.session-title.json')
})

test('a written record reads back', async () => {
  const files = memoryFiles()
  const store = sidecarStore(files, '/s/abc.jsonl')
  await store.write(RECORD)

  assert.deepEqual(await store.read(), RECORD)
  assert.ok(files.all.has('/s/abc.session-title.json'))
})

test('a missing or broken sidecar reads as no record', async () => {
  assert.equal(await sidecarStore(memoryFiles(), '/s/abc.jsonl').read(), undefined)
  assert.equal(await sidecarStore(memoryFiles({ '/s/abc.session-title.json': '{"title":' }), '/s/abc.jsonl').read(), undefined)
  const emptyTitle = JSON.stringify({ title: '', model: 'm', generatedAt: '2026-10-18T04:00:00.000Z' })
  assert.equal(await sidecarStore(memoryFiles({ '/s/abc.session-title.json': emptyTitle }), '/s/abc.jsonl').read(), undefined)
})
