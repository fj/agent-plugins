import assert from 'node:assert/strict'
import { test } from 'node:test'

import { piCacheTtlMs } from '../../../src/adapters/pi/cache.ts'
import { LONG_TTL_MS, SHORT_TTL_MS } from '../../../src/core/cache.ts'

const TIERS = { short: 300, long: 3600 }

test('pi takes the model cache tier the retention picks', () => {
  assert.equal(piCacheTtlMs(TIERS, undefined), SHORT_TTL_MS)
  assert.equal(piCacheTtlMs(TIERS, 'short'), SHORT_TTL_MS)
  assert.equal(piCacheTtlMs(TIERS, 'long'), LONG_TTL_MS)
})

test('pi has no cache lifetime for a tier the model leaves out', () => {
  assert.equal(piCacheTtlMs({ short: 300 }, 'long'), undefined)
  assert.equal(piCacheTtlMs(undefined, undefined), undefined)
})
