import assert from 'node:assert/strict'
import { test } from 'node:test'

import { nextVersion } from '../../scripts/version.ts'

test('a part name bumps that part and zeroes the parts after it', () => {
  assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4')
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0')
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0')
})

test('an explicit version after the current one is kept', () => {
  assert.equal(nextVersion('1.2.3', '1.10.0'), '1.10.0')
})

test('an explicit version that is not after the current one is refused', () => {
  assert.throws(() => nextVersion('1.2.3', '1.2.3'), /not after/)
  assert.throws(() => nextVersion('1.2.3', '1.1.9'), /not after/)
})

test('a request that is neither a part nor x.y.z is refused', () => {
  assert.throws(() => nextVersion('1.2.3', 'v1.3.0'), /is not major, minor, patch or x\.y\.z/)
})
