import assert from 'node:assert/strict'
import { test } from 'node:test'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { modJxfTmuxSpinner } from '../../../src/adapters/pi/extension.ts'

const PANE = '%3'

type Handler = (event: object) => Promise<void>

function fakePi(pane: string | undefined) {
  const handlers = new Map<string, Handler>()
  const states: (string | undefined)[] = []
  const api = { on: (name: string, handler: Handler) => void handlers.set(name, handler) }

  modJxfTmuxSpinner({
    pane,
    run: async argv => {
      assert.equal(argv[argv.indexOf('-t') + 1], PANE)
      states.push(argv[1] === 'set-option' && argv[2] === '-wu' ? undefined : argv.at(-1))
    },
  })(api as unknown as ExtensionAPI)

  return {
    states,
    handlerNames: () => [...handlers.keys()],
    emit: (name: string, event: object = {}) => handlers.get(name)?.({ type: name, ...event }) ?? Promise.resolve(),
  }
}

const reply = (text: string) => ({ messages: [{ role: 'user', content: 'go' }, { role: 'assistant', content: [{ type: 'thinking', thinking: 'hm' }, { type: 'text', text }] }] })

test('outside tmux nothing is hooked', () => {
  assert.deepEqual(fakePi(undefined).handlerNames(), [])
})

test('a run is busy, then done', async () => {
  const pi = fakePi(PANE)
  await pi.emit('agent_start')
  await pi.emit('agent_end', reply('All done.'))
  await pi.emit('agent_settled', { aborted: false })
  assert.deepEqual(pi.states, ['busy', 'done'])
})

test('a run that ends with a question is waiting', async () => {
  const pi = fakePi(PANE)
  await pi.emit('agent_start')
  await pi.emit('agent_end', reply('Shall I go on?'))
  await pi.emit('agent_settled', { aborted: false })
  assert.deepEqual(pi.states, ['busy', 'waiting'])
})

test('an aborted run is done', async () => {
  const pi = fakePi(PANE)
  await pi.emit('agent_start')
  await pi.emit('agent_end', reply('Shall I go on?'))
  await pi.emit('agent_settled', { aborted: true })
  assert.deepEqual(pi.states, ['busy', 'done'])
})

test('a prompt during a run is waiting until it closes', async () => {
  const pi = fakePi(PANE)
  await pi.emit('agent_start')
  await pi.emit('ui_prompt_start', { kind: 'confirm' })
  await pi.emit('ui_prompt_end', { kind: 'confirm' })
  assert.deepEqual(pi.states, ['busy', 'waiting', 'busy'])
})

test('a prompt outside a run changes nothing', async () => {
  const pi = fakePi(PANE)
  await pi.emit('ui_prompt_start', { kind: 'select' })
  await pi.emit('ui_prompt_end', { kind: 'select' })
  assert.deepEqual(pi.states, [])
})

test('the state is cleared when a session starts and shuts down', async () => {
  const pi = fakePi(PANE)
  await pi.emit('session_start')
  await pi.emit('session_shutdown')
  assert.deepEqual(pi.states, [undefined, undefined])
})
