import assert from 'node:assert/strict'
import { test } from 'node:test'

import { latestRun } from '../src/core/latest.ts'

test('older run that finishes last does not overwrite newer result', async () => {
  const run = latestRun()
  const applied: string[] = []
  let finishOld: (value: string) => void = () => {}
  const old = run(new Promise<string>(resolve => (finishOld = resolve)), value => void applied.push(value))

  await run(Promise.resolve('new'), value => void applied.push(value))
  finishOld('old')
  await old

  assert.deepEqual(applied, ['new'])
})

test('each run applies when no newer run started', async () => {
  const run = latestRun()
  const applied: number[] = []

  await run(Promise.resolve(1), value => void applied.push(value))
  await run(Promise.resolve(2), value => void applied.push(value))

  assert.deepEqual(applied, [1, 2])
})
