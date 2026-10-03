import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import { dayDir } from '../src/core/daily.ts'
import { ZERO_TOTALS } from '../src/core/totals.ts'
import { fsDailyStore } from '../pi/fs-daily-store.ts'

const DAY = '2026-10-03'

async function withHome(body: (home: string) => Promise<void>) {
  const home = await mkdtemp(join(tmpdir(), 'mod-jxf-fancy-'))

  try {
    await body(home)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
}

test('each session overwrites only its own file and reads every session of the day', () =>
  withHome(async home => {
    const store = fsDailyStore(home)

    await store.write(DAY, 'pi-a', { ...ZERO_TOTALS, activeMs: 1 })
    await store.write(DAY, 'pi-a', { ...ZERO_TOTALS, activeMs: 2 })
    await store.write(DAY, 'claude-b', { ...ZERO_TOTALS, activeMs: 30 })

    const all = await store.readAll(DAY)

    assert.deepEqual(all.map(t => t.activeMs).sort((a, b) => a - b), [2, 30])
    assert.deepEqual((await readdir(dayDir(home, DAY))).sort(), ['claude-b.json', 'pi-a.json'])
  }))

test('reading can leave out one session, and skips junk and missing days', () =>
  withHome(async home => {
    const store = fsDailyStore(home)

    await store.write(DAY, 'pi-a', { ...ZERO_TOTALS, activeMs: 1 })
    await store.write(DAY, 'pi-b', { ...ZERO_TOTALS, activeMs: 7 })
    await writeFile(join(dayDir(home, DAY), 'broken.json'), '{')

    assert.deepEqual((await store.readAll(DAY, 'pi-a')).map(t => t.activeMs), [7])
    assert.deepEqual(await store.readAll('1999-01-01'), [])
  }))
