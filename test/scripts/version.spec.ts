import assert from 'node:assert/strict'
import { test } from 'node:test'

import { nextVersion, stamped } from '../../scripts/version.ts'

const TIME = new Date('2026-09-15T12:34:56.789Z')
const STAMP = '20260915123456'

test('a part name bumps that part, zeroes the parts after it and stamps the patch', () => {
  assert.equal(nextVersion('1.2.3', 'patch', TIME), `1.2.${STAMP}`)
  assert.equal(nextVersion('1.2.3', 'minor', TIME), `1.3.${STAMP}`)
  assert.equal(nextVersion('1.2.3', 'major', TIME), `2.0.${STAMP}`)
})

test('an explicit x.y after the current version is kept and stamped', () => {
  assert.equal(nextVersion('1.2.3', '1.10', TIME), `1.10.${STAMP}`)
})

test('the stamp is the time in UTC', () => {
  assert.equal(nextVersion('1.2.3', 'patch', new Date('2026-09-15T23:30:00-05:00')), '1.2.20260916043000')
})

test('a stamp that is not after the current one is refused', () => {
  assert.throws(() => nextVersion(`1.2.${STAMP}`, 'patch', TIME), /not after/)
  assert.throws(() => nextVersion(`1.2.${STAMP}`, 'patch', new Date('2026-09-14T00:00:00Z')), /not after/)
})

test('an explicit version that is not after the current one is refused', () => {
  assert.throws(() => nextVersion(`1.2.${STAMP}`, '1.1', TIME), /not after/)
})

test('a request that is neither a part nor x.y is refused', () => {
  assert.throws(() => nextVersion('1.2.3', 'v1.3', TIME), /is not major, minor, patch or x\.y/)
  assert.throws(() => nextVersion('1.2.3', '1.3.0', TIME), /is not major, minor, patch or x\.y/)
})

test('stamped keeps major and minor and puts the stamp in the patch', () => {
  assert.equal(stamped(`1.2.${STAMP}`, new Date('2026-10-04T00:00:01Z')), '1.2.20261004000001')
})

test('stamped refuses a current version that is not x.y.z', () => {
  assert.throws(() => stamped('v1.2.3', TIME), /is not x\.y\.z/)
  assert.throws(() => stamped('1.x', TIME), /is not x\.y\.z/)
})
