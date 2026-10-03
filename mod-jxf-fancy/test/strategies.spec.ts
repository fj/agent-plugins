import assert from 'node:assert/strict'
import { test } from 'node:test'

import { lineText } from '../src/render/segment.ts'
import { anthropicSubscriptionStrategy } from '../src/strategies/subscription/anthropic.ts'
import { subscriptionStrategy } from '../src/strategies/subscription/index.ts'
import { nullSubscriptionStrategy } from '../src/strategies/subscription/null.ts'
import { defaultUsageStrategy } from '../src/strategies/usage/default.ts'
import { usageStrategy } from '../src/strategies/usage/index.ts'
import { canonicalModel } from '../src/strategies/usage/pricing.ts'

const MTOK = 1_000_000

test('canonicalModel strips context, provider, version and date decorations', () => {
  assert.equal(canonicalModel('claude-opus-5-5[1m]'), 'claude-opus-5-5')
  assert.equal(canonicalModel('us.anthropic.claude-sonnet-5'), 'claude-sonnet-5')
  assert.equal(canonicalModel('anthropic/claude-haiku-4-5'), 'claude-haiku-4-5')
  assert.equal(canonicalModel('claude-haiku-4-5-20251001'), 'claude-haiku-4-5')
  assert.equal(canonicalModel('claude-opus-4-6@20260101'), 'claude-opus-4-6')
})

test('default pricing charges each token class at its public rate', () => {
  const cost = defaultUsageStrategy.price('claude-opus-5-5', {
    input: MTOK,
    cacheWrite: MTOK,
    cacheRead: MTOK,
    output: MTOK,
  })

  assert.equal(cost.isLowerBound, false)
  assert.ok(Math.abs(cost.usd - (4 + 5 + 0.2 + 20)) < 1e-9)
})

test('default pricing marks an unknown model as a lower bound', () => {
  const cost = defaultUsageStrategy.price('gpt-9', { input: MTOK, cacheWrite: 0, cacheRead: 0, output: 0 })

  assert.deepEqual(cost, { usd: 0, isLowerBound: true })
})

test('default token line shows new input, cached input, session input and output', () => {
  const step = { input: 400, cacheWrite: 15_000, cacheRead: 61_100, output: 3_200 }
  const session = { input: 1000, cacheWrite: 30_000, cacheRead: 60_800, output: 12_000 }

  assert.equal(lineText(defaultUsageStrategy.stepTokens(step, session)), '↑ Δ 15.4k + ⟲ 61.1k / 91.8k Σ ↓ Δ 3.2k / 12.0k Σ')
})

test('default cost line marks lower bounds with +', () => {
  const line = defaultUsageStrategy.stepCost({ usd: 0.06, isLowerBound: true }, { usd: 1.234, isLowerBound: true })

  assert.equal(lineText(line), 'Δ $0.06+ / $1.23+ Σ')
})

test('unknown strategy names fall back to the defaults', () => {
  assert.equal(usageStrategy('nope').name, 'default')
  assert.equal(subscriptionStrategy('nope').name, 'null')
  assert.equal(subscriptionStrategy('anthropic').name, 'anthropic')
})

test('anthropic strategy prefers host windows', () => {
  const windows = [{ kind: 'five_hour', percentUsed: 42 }]

  assert.deepEqual(anthropicSubscriptionStrategy.read({ windows, headers: {} }), windows)
})

test('anthropic strategy reads unified rate-limit headers', () => {
  const read = anthropicSubscriptionStrategy.read({
    headers: {
      'Anthropic-Ratelimit-Unified-5h-Utilization': '0.42',
      'anthropic-ratelimit-unified-5h-reset': '1800000000',
      'anthropic-ratelimit-unified-status': 'allowed',
    },
  })

  assert.deepEqual(read, [{ kind: '5h', percentUsed: 42, resetsAt: new Date(1800000000 * 1000).toISOString() }])
})

test('anthropic strategy reads nothing off a subscription', () => {
  assert.equal(anthropicSubscriptionStrategy.read({ windows: [], headers: { 'content-type': 'x' } }), null)
})

test('anthropic strategy renders a labeled meter per window', () => {
  const line = anthropicSubscriptionStrategy.render([
    { kind: 'five_hour', percentUsed: 50 },
    { kind: 'seven_day', percentUsed: 12.6 },
  ])

  assert.equal(lineText(line), '5h ▕████    ▏ 50%  7d ▕█       ▏ 13%')
})

test('null strategy reads and renders nothing', () => {
  assert.equal(nullSubscriptionStrategy.read({ windows: [{ kind: 'five_hour', percentUsed: 1 }] }), null)
  assert.deepEqual(nullSubscriptionStrategy.render([]), [])
})

test('a non-Anthropic model behind a provider prefix is still a lower bound', () => {
  const cost = defaultUsageStrategy.price('openrouter/gpt-5', { input: MTOK, cacheWrite: 0, cacheRead: 0, output: 0 })

  assert.equal(canonicalModel('openrouter/gpt-5'), 'gpt-5')
  assert.equal(cost.isLowerBound, true)
})
