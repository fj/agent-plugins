import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseCli } from '../scripts/lib/cli.ts'
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
