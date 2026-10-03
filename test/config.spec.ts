import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseConfig, subscriptionName } from '../src/config/config.ts'

test('the subscription meter follows the provider and OAuth, unless the config overrides it', () => {
  const anthropic = { id: 'claude-opus-5-5', provider: 'anthropic' }

  assert.equal(subscriptionName({}, anthropic, () => true), 'anthropic')
  assert.equal(subscriptionName({}, anthropic, () => false), 'null')
  assert.equal(subscriptionName({}, { id: 'gpt', provider: 'azure' }, () => true), 'null')
  assert.equal(subscriptionName({}, undefined, () => true), 'null')
  assert.equal(subscriptionName({ subscriptionStrategy: 'anthropic' }, undefined, () => false), 'anthropic')
})

test('config keeps only string settings and ignores junk', () => {
  assert.deepEqual(parseConfig('{"usageStrategy":"default","subscriptionStrategy":7}'), {
    usageStrategy: 'default',
    subscriptionStrategy: undefined,
  })
  assert.deepEqual(parseConfig('null'), { usageStrategy: undefined, subscriptionStrategy: undefined })
  assert.deepEqual(parseConfig('nope'), {})
})
