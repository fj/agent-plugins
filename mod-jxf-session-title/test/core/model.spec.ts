import assert from 'node:assert/strict'
import { test } from 'node:test'

import { modelLabel, resolveModelSpec } from '../../src/core/model.ts'

test('a bare model id uses the current provider', () => {
  assert.deepEqual(resolveModelSpec('claude-haiku-5-5', 'claude-bridge'), { provider: 'claude-bridge', id: 'claude-haiku-5-5' })
})

test('a provider and model id are used as given', () => {
  assert.deepEqual(resolveModelSpec('anthropic/claude-haiku-5-5', 'claude-bridge'), { provider: 'anthropic', id: 'claude-haiku-5-5' })
})

test('a bare model id with no current provider resolves to nothing', () => {
  assert.equal(resolveModelSpec('claude-haiku-5-5', undefined), undefined)
})

test('a spec with an empty provider or model resolves to nothing', () => {
  assert.equal(resolveModelSpec('/claude-haiku-5-5', 'anthropic'), undefined)
  assert.equal(resolveModelSpec('anthropic/', 'anthropic'), undefined)
})

test('the label is provider/model', () => {
  assert.equal(modelLabel({ provider: 'anthropic', id: 'haiku' }), 'anthropic/haiku')
})
