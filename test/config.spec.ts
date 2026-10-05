import assert from 'node:assert/strict'
import { test } from 'node:test'

import { footerLayout, parseConfig, subscriptionName, tokenDisplay } from '../src/config/config.ts'

test('the subscription meter follows the provider and OAuth, unless the config overrides it', () => {
  const anthropic = { id: 'claude-opus-5-5', provider: 'anthropic' }

  assert.equal(subscriptionName({}, anthropic, () => true), 'anthropic')
  assert.equal(subscriptionName({}, anthropic, () => false), 'null')
  assert.equal(subscriptionName({}, { id: 'gpt', provider: 'azure' }, () => true), 'null')
  assert.equal(subscriptionName({}, undefined, () => true), 'null')
  assert.equal(subscriptionName({ subscriptionStrategy: 'anthropic' }, undefined, () => false), 'anthropic')
})

test('config keeps only string and boolean settings and ignores junk', () => {
  assert.deepEqual(parseConfig('{"usageStrategy":"default","subscriptionStrategy":7,"combineTotals":true,"showContext":"no","showCachedInput":false}'), {
    usageStrategy: 'default',
    subscriptionStrategy: undefined,
    combineTotals: true,
    showSubscription: undefined,
    showContext: undefined,
    showCachedInput: false,
  })
  assert.deepEqual(parseConfig('null'), {
    usageStrategy: undefined,
    subscriptionStrategy: undefined,
    combineTotals: undefined,
    showSubscription: undefined,
    showContext: undefined,
    showCachedInput: undefined,
  })
  assert.deepEqual(parseConfig('nope'), {})
})

test('the footer layout keeps totals apart and shows every meter unless the config says otherwise', () => {
  assert.deepEqual(footerLayout({}), { isTotalsCombined: false, showsSubscription: true, showsContext: true })
  assert.deepEqual(footerLayout({ combineTotals: true, showSubscription: false, showContext: false }), {
    isTotalsCombined: true,
    showsSubscription: false,
    showsContext: false,
  })
})


test('the token display shows cached input unless the config says otherwise', () => {
  assert.deepEqual(tokenDisplay({}), { showsCachedInput: true })
  assert.deepEqual(tokenDisplay({ showCachedInput: false }), { showsCachedInput: false })
})
