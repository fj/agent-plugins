import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cacheRemainingMs, claudeCodeCacheTtlMs, LONG_TTL_MS, SHORT_TTL_MS } from '../src/core/cache.ts'

const API_USER = { env: {}, isBedrock: false, isSubscriber: false }
const SUBSCRIBER = { ...API_USER, isSubscriber: true }

test('Claude Code keeps the cache an hour for a subscriber and five minutes otherwise', () => {
  assert.equal(claudeCodeCacheTtlMs(SUBSCRIBER), LONG_TTL_MS)
  assert.equal(claudeCodeCacheTtlMs(API_USER), SHORT_TTL_MS)
})

test('Claude Code has no cache lifetime with prompt caching off, whatever else is set', () => {
  assert.equal(claudeCodeCacheTtlMs({ ...SUBSCRIBER, env: { disable: '1', force5m: '1' } }), undefined)
  assert.equal(claudeCodeCacheTtlMs({ ...SUBSCRIBER, env: { disable: '0' } }), LONG_TTL_MS)
})

test('Claude Code forcing five minutes beats the TTL variable', () => {
  assert.equal(claudeCodeCacheTtlMs({ ...SUBSCRIBER, env: { force5m: '1', ttl: '1h' } }), SHORT_TTL_MS)
})

test('the Claude Code TTL variable beats the setting', () => {
  assert.equal(claudeCodeCacheTtlMs({ ...SUBSCRIBER, env: { ttl: '5m' }, setting: '1h' }), SHORT_TTL_MS)
})

test('an unknown Claude Code TTL variable falls through to the setting', () => {
  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, env: { ttl: 'forever' }, setting: '1h' }), LONG_TTL_MS)
  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, env: { ttl: 'forever' } }), SHORT_TTL_MS)
})

test('the Claude Code TTL setting beats enable-1h and the subscriber default', () => {
  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, env: { enable1h: '1' }, setting: '5m' }), SHORT_TTL_MS)
  assert.equal(claudeCodeCacheTtlMs({ ...SUBSCRIBER, setting: '5m' }), SHORT_TTL_MS)
  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, setting: '1h' }), LONG_TTL_MS)
})

test('Claude Code enable-1h keeps an API user cache an hour', () => {
  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, env: { enable1h: 'true' } }), LONG_TTL_MS)
})

test('Claude Code takes the Bedrock enable-1h variable only on Bedrock', () => {
  const env = { enable1hBedrock: '1' }

  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, env, isBedrock: true }), LONG_TTL_MS)
  assert.equal(claudeCodeCacheTtlMs({ ...API_USER, env }), SHORT_TTL_MS)
})

test('the cache remains until its lifetime after it was last used, then stays at zero', () => {
  assert.equal(cacheRemainingMs(1000, SHORT_TTL_MS, 1000 + 60_000), SHORT_TTL_MS - 60_000)
  assert.equal(cacheRemainingMs(1000, SHORT_TTL_MS, 1000 + SHORT_TTL_MS), 0)
  assert.equal(cacheRemainingMs(1000, SHORT_TTL_MS, 1000 + SHORT_TTL_MS * 2), 0)
})

test('the cache has no remaining time without a last use or a lifetime', () => {
  assert.equal(cacheRemainingMs(undefined, SHORT_TTL_MS, 0), undefined)
  assert.equal(cacheRemainingMs(1000, undefined, 0), undefined)
})
