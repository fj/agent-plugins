import assert from 'node:assert/strict'
import { test } from 'node:test'

import { footerLayout, parseConfig, subscriptionName } from '../src/config/config.ts'

test('the subscription meter follows the provider and OAuth, unless the config overrides it', () => {
  const anthropic = { id: 'claude-opus-5-5', provider: 'anthropic' }

  assert.equal(subscriptionName({}, anthropic, () => true), 'anthropic')
  assert.equal(subscriptionName({}, anthropic, () => false), 'null')
  assert.equal(subscriptionName({}, { id: 'gpt', provider: 'azure' }, () => true), 'null')
  assert.equal(subscriptionName({}, undefined, () => true), 'null')
  assert.equal(subscriptionName({ subscriptionStrategy: 'anthropic' }, undefined, () => false), 'anthropic')
})

test('config keeps only string and boolean settings and ignores junk', () => {
  assert.deepEqual(parseConfig('{"usageStrategy":"default","subscriptionStrategy":7,"showContext":"no"}'), {
    usageStrategy: 'default',
    subscriptionStrategy: undefined,
    showContext: undefined,
  })
  assert.deepEqual(parseConfig('null'), {
    usageStrategy: undefined,
    subscriptionStrategy: undefined,
    showContext: undefined,
  })
  assert.deepEqual(parseConfig('nope'), {})
})

test('the footer layout shows the context unless the config says otherwise', () => {
  assert.deepEqual(footerLayout({}), { showsContext: true })
  assert.deepEqual(footerLayout({ showContext: false }), { showsContext: false })
})

