import assert from 'node:assert/strict'
import { test } from 'node:test'

import { identityArgv, stateArgv, tmuxPane } from '../../src/core/tmux.ts'

test('the pane is known only inside tmux', () => {
  assert.equal(tmuxPane('/tmp/tmux-1000/default,1,0', '%3'), '%3')
  assert.equal(tmuxPane(undefined, '%3'), undefined)
  assert.equal(tmuxPane('', '%3'), undefined)
  assert.equal(tmuxPane('/tmp/tmux-1000/default,1,0', undefined), undefined)
})

test('a state is set on the window of the pane', () => {
  assert.deepEqual(stateArgv('%3', 'busy'), ['tmux', 'set-option', '-w', '-t', '%3', '@agent_state', 'busy'])
})

test('no state unsets the option', () => {
  assert.deepEqual(stateArgv('%3', undefined), ['tmux', 'set-option', '-wu', '-t', '%3', '@agent_state'])
})

test('an identity sets the harness and session in one tmux call', () => {
  assert.deepEqual(identityArgv('%3', { harness: 'pi', session: '/s.jsonl' }), [
    'tmux', 'set-option', '-w', '-t', '%3', '@agent_harness', 'pi', ';', 'set-option', '-w', '-t', '%3', '@agent_session', '/s.jsonl',
  ])
})

test('no identity unsets the harness and session', () => {
  assert.deepEqual(identityArgv('%3', undefined), [
    'tmux', 'set-option', '-wu', '-t', '%3', '@agent_harness', ';', 'set-option', '-wu', '-t', '%3', '@agent_session',
  ])
})
