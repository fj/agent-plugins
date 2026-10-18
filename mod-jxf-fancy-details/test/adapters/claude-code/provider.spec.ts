import assert from 'node:assert/strict'
import { test } from 'node:test'

import { claudeCodeBilling, claudeCodeProvider, type CloudFlags } from '../../../src/adapters/claude-code/provider.ts'

const CLOUD_LABELS: readonly (readonly [keyof CloudFlags, string])[] = [
  ['bedrock', 'bedrock'],
  ['vertex', 'vertex'],
  ['foundry', 'azure'],
  ['anthropicAws', 'aws'],
  ['anthropicGoogleCloud', 'gcp'],
  ['mantle', 'mantle'],
  ['gateway', 'gateway'],
]

test('Claude Code names the cloud each flag selects', () => {
  for (const [flag, label] of CLOUD_LABELS) {
    assert.equal(claudeCodeProvider({ [flag]: '1' }), label, flag)
  }
})

test('Claude Code names Anthropic when no cloud flag is on', () => {
  assert.equal(claudeCodeProvider({}), 'anthropic')
  assert.equal(claudeCodeProvider({ vertex: '0', bedrock: 'false' }), 'anthropic')
})

test('Claude Code names the first cloud flag in its list when several are on', () => {
  assert.equal(claudeCodeProvider({ gateway: '1', bedrock: '1' }), 'bedrock')
})

test('only an Anthropic bearer credential bills to a subscription', () => {
  assert.equal(claudeCodeBilling('anthropic', 'bearer'), 'subscription')
  assert.equal(claudeCodeBilling('anthropic', 'api-key'), 'api')
  assert.equal(claudeCodeBilling('anthropic', undefined), 'api')
  assert.equal(claudeCodeBilling('azure', 'bearer'), 'api')
})
