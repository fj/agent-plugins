import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'

import { dayDir, parseTotals, sessionFile, type DailyStore } from '../src/core/daily.ts'
import type { Totals } from '../src/core/totals.ts'

const SESSION_FILE_SUFFIX = '.json'

async function listSessionFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).filter(name => name.endsWith(SESSION_FILE_SUFFIX))
  } catch {
    return []
  }
}

async function readTotals(path: string): Promise<Totals | null> {
  try {
    return parseTotals(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

export function fsDailyStore(home: string): DailyStore {
  return {
    async write(day, sessionKey, totals) {
      const path = sessionFile(home, day, sessionKey)
      const staging = `${path}.${process.pid}.tmp`

      await mkdir(dayDir(home, day), { recursive: true })
      await writeFile(staging, JSON.stringify(totals))
      await rename(staging, path)
    },

    async readAll(day, exceptSessionKey) {
      const dir = dayDir(home, day)
      const skip = exceptSessionKey === undefined ? undefined : basename(sessionFile(home, day, exceptSessionKey))
      const names = (await listSessionFiles(dir)).filter(name => name !== skip)
      const totals = await Promise.all(names.map(name => readTotals(join(dir, name))))

      return totals.filter(value => value !== null)
    },
  }
}
