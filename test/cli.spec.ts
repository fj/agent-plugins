import assert from 'node:assert/strict'
import { test } from 'node:test'

import { main, parseCli } from '../scripts/lib/cli.ts'
import { parseHarnesses } from '../scripts/lib/harness.ts'

test('a leading -- from pnpm is ignored', () => {
  assert.deepEqual(parseCli(['--', 'claude', '--dry-run'], { dryRun: true }), { positionals: ['claude'], dryRun: true })
  assert.deepEqual(parseCli(['claude', 'jxf'], { dryRun: true }), { positionals: ['claude', 'jxf'], dryRun: false })
})

test('--dry-run is refused where it does not apply', () => {
  assert.throws(() => parseCli(['--dry-run']), /Unknown option '--dry-run'/)
})

test('harness lists default to all harnesses and reject unknown ones', () => {
  assert.deepEqual(parseHarnesses([]), ['claude', 'pi'])
  assert.deepEqual(parseHarnesses(['pi']), ['pi'])
  assert.throws(() => parseHarnesses(['claude', 'codex']), /harness must be one of claude, pi; got codex/)
})

test('main exits with an error when the action fails or reports failure', async (t) => {
  const errors = t.mock.method(console, 'error', () => {})
  t.after(() => {
    process.exitCode = 0
  })
  const exitAfter = async (action: () => Promise<boolean | void>) => {
    process.exitCode = 0
    await main(action)
    return process.exitCode
  }

  assert.equal(await exitAfter(async () => {}), 0)
  assert.equal(await exitAfter(async () => true), 0)
  assert.equal(await exitAfter(async () => false), 1)
  assert.equal(
    await exitAfter(async () => {
      throw new Error('boom')
    }),
    1,
  )
  assert.deepEqual(errors.mock.calls.map((call) => call.arguments), [['boom']])
})
