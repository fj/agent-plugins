import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { dayDir, type DailyStore, type DayKey } from '../src/core/daily.ts'
import { ZERO_TOTALS, type Totals } from '../src/core/totals.ts'
import { fileDailyStore, type FileEntry, type Files } from '../src/adapters/claude-code/daily.ts'
import { fsDailyStore } from '../src/adapters/pi/fs-daily-store.ts'

const DAY = '2026-10-03'
const HOME = '/home/tester'

type Harness = {
  store: DailyStore
  plant(day: DayKey, name: string, text: string): Promise<void>
  close(): Promise<void>
}

async function piHarness(): Promise<Harness> {
  const home = await mkdtemp(join(tmpdir(), 'mod-jxf-fancy-details-'))

  return {
    store: fsDailyStore(home),
    async plant(day, name, text) {
      await mkdir(dayDir(home, day), { recursive: true })
      await writeFile(join(dayDir(home, day), name), text)
    },
    close: () => rm(home, { recursive: true, force: true }),
  }
}

function memoryFiles(): { files: Files; texts: Map<string, string> } {
  const texts = new Map<string, string>()
  const files: Files = {
    write: async (path, text) => void texts.set(path, text),
    read: async path => {
      const text = texts.get(path)

      if (text === undefined) {
        throw new Error(`ENOENT: ${path}`)
      }

      return text
    },
    list: async dir => {
      const names = [...texts.keys()].filter(path => path.startsWith(`${dir}/`)).map(path => path.slice(dir.length + 1))

      if (names.length === 0) {
        throw new Error(`ENOENT: ${dir}`)
      }

      return names.map((name): FileEntry => ({ name, kind: 'file' }))
    },
  }

  return { files, texts }
}

async function claudeHarness(): Promise<Harness> {
  const { files, texts } = memoryFiles()

  return {
    store: fileDailyStore(files, HOME),
    plant: async (day, name, text) => void texts.set(`${dayDir(HOME, day)}/${name}`, text),
    close: async () => undefined,
  }
}

const HARNESSES: Record<string, () => Promise<Harness>> = { pi: piHarness, 'claude code': claudeHarness }

const active = (activeMs: number): Totals => ({ ...ZERO_TOTALS, activeMs })

const sortedActive = (all: readonly Totals[]) => all.map(t => t.activeMs).sort((a, b) => a - b)

for (const [host, open] of Object.entries(HARNESSES)) {
  const withStore = (body: (h: Harness) => Promise<void>) => async () => {
    const harness = await open()

    try {
      await body(harness)
    } finally {
      await harness.close()
    }
  }

  test(
    `${host} store: each session overwrites only its own file and reading sees every session`,
    withStore(async ({ store }) => {
      await store.write(DAY, 'pi-a', active(1))
      await store.write(DAY, 'pi-a', active(2))
      await store.write(DAY, 'claude-code-b', active(30))

      assert.deepEqual(sortedActive(await store.readAll(DAY)), [2, 30])
    }),
  )

  test(
    `${host} store: reading skips the caller's own session`,
    withStore(async ({ store }) => {
      await store.write(DAY, 'claude-code-a/b', active(1))
      await store.write(DAY, 'pi-c', active(7))

      assert.deepEqual(sortedActive(await store.readAll(DAY, 'claude-code-a/b')), [7])
      assert.deepEqual(sortedActive(await store.readAll(DAY, 'pi-c')), [1])
      assert.deepEqual(sortedActive(await store.readAll(DAY, 'pi-unknown')), [1, 7])
    }),
  )

  test(
    `${host} store: reading skips junk, staging files and missing days`,
    withStore(async ({ store, plant }) => {
      await store.write(DAY, 'pi-a', active(1))
      await plant(DAY, 'broken.json', '{')
      await plant(DAY, 'other-shape.json', '{"cost": 3}')
      await plant(DAY, 'pi-b.json.123.tmp', JSON.stringify(active(9)))

      assert.deepEqual(sortedActive(await store.readAll(DAY)), [1])
      assert.deepEqual(await store.readAll('1999-01-01'), [])
    }),
  )
}

test('the pi store leaves only session files behind', async () => {
  const home = await mkdtemp(join(tmpdir(), 'mod-jxf-fancy-details-'))

  try {
    const store = fsDailyStore(home)
    await store.write(DAY, 'pi-a', active(1))
    await store.write(DAY, 'claude/b', active(2))

    assert.deepEqual((await readdir(dayDir(home, DAY))).sort(), ['claude_b.json', 'pi-a.json'])
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
