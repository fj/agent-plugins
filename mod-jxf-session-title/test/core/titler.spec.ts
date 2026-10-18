import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { TitleRecord } from '../../src/core/sidecar.ts'
import type { TitleRequest } from '../../src/core/title.ts'
import { titler, type ModelChoice, type TitleHarness, type TitlerSettings } from '../../src/core/titler.ts'

const SETTINGS: TitlerSettings = { isAutomatic: true, instructions: 'Name it.', maxPromptChars: 100, maxTitleChars: 40, maxReplyTokens: 64 }
const MODEL = { provider: 'claude-bridge', id: 'claude-haiku-5-5' }
const T0 = Date.UTC(2026, 9, 18, 4)
const OLD_RECORD: TitleRecord = { title: 'Old title', model: 'm', generatedAt: '2026-10-18T03:00:00.000Z' }

type Shown = { asking: string } | { title: string | undefined }

type HarnessOptions = {
  session?: string
  native?: string
  stored?: TitleRecord
  hasStore?: boolean
  reply?: string | Error
  choice?: ModelChoice
  prompts?: string[]
}

function fakeHarness(options: HarnessOptions = {}) {
  const shown: Shown[] = []
  const warnings: string[] = []
  const requests: TitleRequest[] = []
  const records: TitleRecord[] = []
  const applied: string[] = []
  let native = options.native
  let stored = options.stored
  let release: () => void = () => {}
  const gate = new Promise<void>(resolve => (release = resolve))
  let isGated = false

  const harness: TitleHarness = {
    session: options.session ?? 'sess-1',
    store:
      options.hasStore === false
        ? undefined
        : {
            read: async () => stored,
            async write(record) {
              records.push(record)
              stored = record
            },
          },
    now: async () => T0,
    model: async () => options.choice ?? { isAvailable: true, model: MODEL },
    async complete(_model, request) {
      requests.push(request)

      if (isGated) {
        await gate
      }

      if (options.reply instanceof Error) {
        throw options.reply
      }

      return options.reply ?? 'Fix auth refresh'
    },
    prompts: async () => options.prompts ?? ['first', 'second'],
    nativeTitle: async () => native,
    async applyTitle(title) {
      applied.push(title)
      native = title
    },
    showAsking: async label => void shown.push({ asking: label }),
    showTitle: async title => void shown.push({ title }),
    warn: async message => void warnings.push(message),
  }

  return { harness, shown, warnings, requests, records, applied, gateNext: () => (isGated = true), release: () => release() }
}

test('the first prompt of an untitled session is titled, stored and applied', async () => {
  const h = fakeHarness()
  await titler(() => SETTINGS).titleFirstPrompt(h.harness, 'fix the auth refresh')

  assert.deepEqual(h.requests, [{ system: 'Name it.', prompt: '<request>\nfix the auth refresh\n</request>', maxTokens: 64 }])
  assert.deepEqual(h.records, [{ title: 'Fix auth refresh', model: 'claude-bridge/claude-haiku-5-5', generatedAt: '2026-10-18T04:00:00.000Z' }])
  assert.deepEqual(h.applied, ['Fix auth refresh'])
  assert.deepEqual(h.shown, [{ asking: 'claude-bridge/claude-haiku-5-5' }, { title: 'Fix auth refresh' }])
})

test('a session with a native or a stored title is not titled again by a prompt', async () => {
  for (const options of [{ native: 'Mine' }, { stored: OLD_RECORD }]) {
    const h = fakeHarness(options)
    await titler(() => SETTINGS).titleFirstPrompt(h.harness, 'more work')

    assert.deepEqual(h.requests, [])
  }
})

test('a harness with no store is still titled and applied', async () => {
  const h = fakeHarness({ hasStore: false })
  await titler(() => SETTINGS).titleFirstPrompt(h.harness, 'fix it')

  assert.deepEqual(h.applied, ['Fix auth refresh'])
})

test('automatic titles can be turned off', async () => {
  const h = fakeHarness()
  await titler(() => ({ ...SETTINGS, isAutomatic: false })).titleFirstPrompt(h.harness, 'fix it')

  assert.deepEqual(h.requests, [])
})

test('regenerating titles a titled session from all its prompts', async () => {
  const h = fakeHarness({ native: 'Old title', stored: OLD_RECORD, reply: 'New title' })
  await titler(() => SETTINGS).regenerate(h.harness)

  assert.equal(h.requests[0]?.prompt, '<request>\nfirst\n\nsecond\n</request>')
  assert.deepEqual(h.applied, ['New title'])
  assert.deepEqual(h.shown.at(-1), { title: 'New title' })
})

test('a second request in the same session while one is pending is dropped', async () => {
  const h = fakeHarness()
  const titles = titler(() => SETTINGS)
  h.gateNext()
  const first = titles.regenerate(h.harness)
  await titles.regenerate(h.harness)
  h.release()
  await first

  assert.equal(h.requests.length, 1)
})

test('a pending request in one session does not block another session', async () => {
  const first = fakeHarness()
  const second = fakeHarness({ session: 'sess-2' })
  const titles = titler(() => SETTINGS)
  first.gateNext()
  const pending = titles.titleFirstPrompt(first.harness, 'one')
  await titles.titleFirstPrompt(second.harness, 'two')
  first.release()
  await pending

  assert.equal(first.requests.length, 1)
  assert.equal(second.requests.length, 1)
})

test('an unavailable model warns and keeps the saved title', async () => {
  const h = fakeHarness({ native: 'Old title', choice: { isAvailable: false, reason: 'model x/y is not available' } })
  await titler(() => SETTINGS).regenerate(h.harness)

  assert.deepEqual(h.warnings, ['model x/y is not available'])
  assert.deepEqual(h.shown, [{ title: 'Old title' }])
})

test('a failed or empty reply warns and keeps the saved title', async () => {
  for (const reply of [new Error('HTTP 529'), '  ""  ']) {
    const h = fakeHarness({ native: 'Old title', reply })
    await titler(() => SETTINGS).regenerate(h.harness)

    assert.equal(h.warnings.length, 1)
    assert.deepEqual(h.records, [])
    assert.deepEqual(h.applied, [])
    assert.deepEqual(h.shown.at(-1), { title: 'Old title' })
  }
})

test('regenerating with no prompts warns', async () => {
  const h = fakeHarness({ prompts: [] })
  await titler(() => SETTINGS).regenerate(h.harness)

  assert.deepEqual(h.warnings, ['there is no prompt to name the session from'])
  assert.deepEqual(h.requests, [])
})

test('restoring applies and shows a stored title when the session has no native title', async () => {
  const h = fakeHarness({ stored: OLD_RECORD })
  await titler(() => SETTINGS).restore(h.harness)

  assert.deepEqual(h.applied, ['Old title'])
  assert.deepEqual(h.shown, [{ title: 'Old title' }])
})

test('restoring keeps a native title ahead of a different stored one', async () => {
  const h = fakeHarness({ native: 'Mine', stored: OLD_RECORD })
  await titler(() => SETTINGS).restore(h.harness)

  assert.deepEqual(h.applied, [])
  assert.deepEqual(h.shown, [{ title: 'Mine' }])
})
