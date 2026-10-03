import assert from 'node:assert/strict'
import { afterEach, beforeEach, mock, test } from 'node:test'

import { CUSTOM_TYPE, FRAME_MS, HAT_WIDGET, MAX_PERSIST_POLLS, modJxfFancy, PERSIST_POLL_MS } from '../pi/extension.ts'
import type { ToolRow } from '../pi/tool-rows.ts'
import { ZERO_TOTALS } from '../src/core/totals.ts'
import { BANNER_TEXT } from '../src/render/robot.ts'
import { fakeCtx, fakePi, fakeTui, footerData, measure, memoryStore, plain, type FakeEntry } from './pi-fakes.ts'

const T0 = new Date(2026, 9, 3, 4, 20, 37).getTime()
const WIDTH = 200
const USAGE = { input: 400, cacheWrite: 15_000, cacheRead: 61_100, output: 3_200 }
const RATE_LIMIT_HEADERS = {
  'anthropic-ratelimit-unified-5h-utilization': '0.42',
  'anthropic-ratelimit-unified-5h-reset': '1790000000',
}

beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'setInterval'] }))
afterEach(() => mock.timers.reset())

class FakeToolRow {
  toolCallId: string
  constructor(id: string) {
    this.toolCallId = id
  }
  render(_width: number) {
    return ['', 'tool box']
  }
}

function setup(options: { branch?: FakeEntry[]; mode?: string; provider?: string; others?: number } = {}) {
  let clock = T0
  let ids = 0
  const pi = fakePi()
  const { ctx, widgets, footer } = fakeCtx(pi.branch, options)
  const others = options.others === undefined ? [] : [{ ...ZERO_TOTALS, cost: { usd: options.others, isLowerBound: false } }]
  const { store, writes } = memoryStore(others)
  const tui = fakeTui()

  pi.branch.push(...(options.branch ?? []))
  modJxfFancy({
    measure,
    store,
    home: '/home/j',
    configPath: '/nowhere/mod-jxf-fancy.json',
    toolRows: FakeToolRow.prototype,
    readConfig: () => ({}),
    now: () => clock,
    newId: () => `id${(ids += 1)}`,
  })(pi.api)

  const emit = (name: string, event: object = {}) => pi.emit(name, event, ctx)
  const advance = (ms: number) => {
    clock += ms
    mock.timers.tick(ms)
  }
  const footerLines = (data = footerData()) => footer()?.(tui, {}, data).render(WIDTH).map(plain)
  const ours = () => pi.branch.filter(entry => entry.customType === CUSTOM_TYPE)
  const shown = (entry: FakeEntry) => plain(pi.render(entry, WIDTH)?.join('\n') ?? '')

  return { pi, ctx, widgets, footerLines, writes, tui, emit, advance, ours, shown }
}

async function submit(s: ReturnType<typeof setup>, text = 'hello') {
  const message = { role: 'user', content: text, timestamp: T0 }

  await s.emit('agent_start')
  await s.emit('message_start', { message })
  await s.emit('message_end', { message })
  s.pi.branch.push({ type: 'message', message })
  s.advance(0)

  return message
}

test('the prompt timer is recorded after the user message persists and runs until the first reply', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  await submit(s)

  const [prompt] = s.ours()

  assert.equal(s.pi.branch.indexOf(prompt!) > s.pi.branch.findIndex(entry => entry.type === 'message'), true)
  s.advance(2300)
  assert.equal(s.shown(prompt!), ' {2026-10-03 04:20:37 Δ 2.3s}')
  assert.match(s.pi.render(prompt!, WIDTH)?.[0] ?? '', /\x1b\[38;2;/)

  await s.emit('message_start', { message: { role: 'assistant', model: 'claude-opus-5-5' } })
  s.advance(5000)
  assert.equal(s.shown(prompt!), ' {2026-10-03 04:20:37 Δ 2.3s}')
  assert.equal(s.pi.render(prompt!, WIDTH)?.[0], ' \x1b[38;2;138;138;138m{2026-10-03 04:20:37 Δ 2.3s}\x1b[39m')
})

test('a prompt record waits for the user message, but never past the next record', async () => {
  const s = setup()
  const message = { role: 'user', content: 'x', timestamp: T0 }

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('message_end', { message })
  s.advance(PERSIST_POLL_MS)
  assert.equal(s.ours().length, 0)

  await s.emit('message_start', { message: { role: 'assistant', model: 'm' } })
  assert.deepEqual(
    s.ours().map(entry => (entry.data as { kind: string }).kind),
    ['prompt', 'step', 'message'],
  )
})

test('the message prefix fills in tokens and cost when the step ends, and tools get live timers', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  await submit(s)
  await s.emit('message_start', { message: { role: 'assistant', model: 'claude-opus-5-5' } })
  const step = s.ours().find(entry => (entry.data as { kind: string }).kind === 'step')!

  s.advance(1500)
  assert.equal(s.shown(step), ' {2026-10-03 04:20:37 Δ 1.5s} {turn 1.1}')

  await s.emit('message_end', { message: { role: 'assistant', model: 'claude-opus-5-5', usage: USAGE } })
  assert.match(s.shown(step), /\{turn 1\.1: ↑ Δ 15\.4k \+ ⟲ 61\.1k \/ 76\.5k Σ ↓ Δ 3\.2k \/ 3\.2k Σ\} \{Δ \$0\.\d\d \/ \$0\.\d\d Σ\}$/)

  const row = new FakeToolRow('call-1') as ToolRow

  assert.deepEqual(row.render(WIDTH), ['', 'tool box'])
  await s.emit('tool_execution_start', { toolCallId: 'call-1', toolName: 'bash', args: {} })
  s.advance(700)
  assert.equal(plain(row.render(WIDTH)[1] ?? ''), ' {2026-10-03 04:20:38 Δ 0.7s}')
  await s.emit('tool_execution_end', { toolCallId: 'call-1', toolName: 'bash', result: {}, isError: false })
  s.advance(9000)
  assert.equal(plain(row.render(WIDTH)[1] ?? ''), ' {2026-10-03 04:20:38 Δ 0.7s}')

  await s.emit('tool_execution_start', { toolCallId: 'call-1/1', toolName: 'read', args: {} })
  assert.equal(s.ours().filter(entry => (entry.data as { id?: string }).id === 'call-1/1').length, 0)
})

test('settling a run records the active time, writes today, and stops the frame timer', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  s.footerLines()
  await submit(s)
  await s.emit('message_start', { message: { role: 'assistant', model: 'claude-opus-5-5' } })
  await s.emit('message_end', { message: { role: 'assistant', model: 'claude-opus-5-5', usage: USAGE } })

  const before = s.tui.renders()

  s.advance(FRAME_MS * 3)
  assert.equal(s.tui.renders() - before, 3)

  s.advance(4000)
  await s.emit('agent_settled')
  s.advance(FRAME_MS * 2)
  const settled = s.tui.renders()

  s.advance(FRAME_MS * 10)
  assert.equal(s.tui.renders(), settled)
  assert.equal((s.ours().at(-1)?.data as { kind: string }).kind, 'turnEnd')
  assert.equal(s.writes.at(-1)?.key, 'pi-sess-1')
  assert.equal(s.writes.at(-1)?.totals.activeMs, 4000 + FRAME_MS * 3)
})

test('the footer shows model, path, session, quota and today across sessions, right-aligned', async () => {
  const s = setup({ others: 10 })

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('after_provider_response', { status: 200, headers: RATE_LIMIT_HEADERS })

  const [status, head, session, today, quota, ...rest] = s.footerLines(footerData({ lens: 'lens ok' }))!

  assert.equal(status, 'lens ok')
  assert.deepEqual(rest, [])
  assert.ok([head, session, today, quota].every(line => [...line!].length === WIDTH))
  assert.match(head!, /^\(main\) +claude-opus-5-5 · ~\/src\/projects\/demo$/)
  assert.match(session!, /^ +session 0\.0s · \$0\.00 ↑0 ↓0$/)
  assert.match(today!, /^ +today 0\.0s · \$10\.00 ↑0 ↓0$/)
  assert.match(quota!, /^ +5h ▕.*▏ 42%$/)
})

test('a provider without a subscription shows no meter', async () => {
  const s = setup({ provider: 'azure' })

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('after_provider_response', { status: 200, headers: RATE_LIMIT_HEADERS })

  assert.doesNotMatch(s.footerLines()!.join('\n'), /5h/)
})

test('the top hat shows in a new session until the first input', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'new' })
  const hat = s.widgets.get(HAT_WIDGET)?.(s.tui, {}).render(WIDTH).map(plain)

  assert.ok(hat?.some(line => line.endsWith(BANNER_TEXT)))
  await s.emit('input', { text: 'hi', source: 'interactive' })
  assert.equal(s.widgets.get(HAT_WIDGET), undefined)
  assert.ok(s.widgets.has(HAT_WIDGET))
})

test('a resumed session gets no hat and rebuilds prefixes from its records', async () => {
  const records = [
    { kind: 'prompt', id: 'p', at: T0 },
    { kind: 'step', id: 's', at: T0 + 1000, model: 'claude-opus-5-5' },
    { kind: 'message', id: 's', at: T0 + 1000 },
    { kind: 'stepEnd', id: 's', at: T0 + 4000, usage: USAGE },
    { kind: 'turnEnd', at: T0 + 5000 },
  ]
  const branch: FakeEntry[] = [
    { type: 'message', message: { role: 'user' } },
    ...records.map(data => ({ type: 'custom', customType: CUSTOM_TYPE, data })),
  ]
  const s = setup({ branch })

  await s.emit('session_start', { reason: 'resume' })

  assert.equal(s.widgets.has(HAT_WIDGET), false)
  assert.equal(s.shown(branch[1]!), ' {2026-10-03 04:20:37 Δ 1.0s}')
  assert.match(s.shown(branch[2]!), /^ \{2026-10-03 04:20:38 Δ 3\.0s\} \{turn 1\.1: ↑ Δ 15\.4k/)
  assert.equal(s.pi.renders(branch[3]!), false)
  assert.equal(s.pi.renders(branch[4]!), false)
  assert.match(s.footerLines()![1]!, /session 5\.0s · \$0\.\d\d /)
})

test('print mode records usage but draws nothing and leaves tool rows alone', async () => {
  const s = setup({ mode: 'print' })

  await s.emit('session_start', { reason: 'startup' })
  await submit(s)
  await s.emit('tool_execution_start', { toolCallId: 'c', toolName: 'bash', args: {} })

  assert.equal(s.footerLines(), undefined)
  assert.equal(s.widgets.size, 0)
  assert.deepEqual(new FakeToolRow('c').render(WIDTH), ['', 'tool box'])
  assert.equal(s.ours().length, 2)
})

test('shutting down restores tool rows and stops every timer', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  s.footerLines()
  await submit(s)
  await s.emit('tool_execution_start', { toolCallId: 'c', toolName: 'bash', args: {} })
  await s.emit('session_shutdown', { reason: 'quit' })

  const renders = s.tui.renders()

  s.advance(60_000)
  assert.equal(s.tui.renders(), renders)
  assert.deepEqual(new FakeToolRow('c').render(WIDTH), ['', 'tool box'])
})

test('a prompt whose user message never persists is still recorded after the poll limit', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('message_end', { message: { role: 'user', content: 'x', timestamp: T0 } })

  for (let poll = 0; poll < MAX_PERSIST_POLLS; poll += 1) {
    s.advance(PERSIST_POLL_MS)
  }

  assert.equal(s.ours().length, 0)
  s.advance(PERSIST_POLL_MS)
  assert.deepEqual(
    s.ours().map(entry => (entry.data as { kind: string }).kind),
    ['prompt'],
  )
})

test('moving to another branch replays that branch for the prefixes', async () => {
  const step = (output: number) => [
    { kind: 'prompt', id: 'p', at: T0 },
    { kind: 'step', id: 's', at: T0, model: 'claude-opus-5-5' },
    { kind: 'message', id: 's', at: T0 },
    { kind: 'stepEnd', id: 's', at: T0 + 1000, usage: { ...USAGE, output } },
  ]
  const s = setup({ branch: step(1000).map(data => ({ type: 'custom', customType: CUSTOM_TYPE, data })) })
  const entry = { type: 'custom', customType: CUSTOM_TYPE, data: step(0)[1] }

  await s.emit('session_start', { reason: 'resume' })
  assert.match(s.shown(entry), /↓ Δ 1\.0k/)

  s.pi.branch.splice(0, s.pi.branch.length, ...step(2000).map(data => ({ type: 'custom', customType: CUSTOM_TYPE, data })))
  await s.emit('session_tree', {})
  assert.match(s.shown(entry), /↓ Δ 2\.0k/)
})

test('switching to a model without a subscription drops the meter', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('after_provider_response', { status: 200, headers: RATE_LIMIT_HEADERS })
  assert.match(s.footerLines()!.at(-1)!, /^ +5h/)

  await s.emit('model_select', { model: { id: 'gpt-5', provider: 'azure' }, source: 'set' })
  await s.emit('after_provider_response', { status: 200, headers: RATE_LIMIT_HEADERS })
  assert.doesNotMatch(s.footerLines()!.join('\n'), /5h/)
  assert.match(s.footerLines()![0]!, /gpt-5 · /)
})

test('tool calls made by another tool are not timed', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('tool_execution_start', { toolCallId: 'child', parentToolCallId: 'parent', toolName: 'read', args: {} })
  await s.emit('tool_execution_end', { toolCallId: 'child', parentToolCallId: 'parent', toolName: 'read', result: {}, isError: false })

  assert.equal(s.ours().length, 0)
})

test('settling without a prompt records no turn', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  await s.emit('agent_start')
  await s.emit('agent_settled')

  assert.equal(s.ours().length, 0)
  assert.equal(s.writes.length, 0)
})

test('the footer flattens multi-line statuses, drops blank ones, and omits a missing branch', async () => {
  const s = setup()

  await s.emit('session_start', { reason: 'startup' })
  const lines = s.footerLines(footerData({ a: 'one\ntwo', b: '  ', c: 'three' }, null))!

  assert.equal(lines[0], 'one two three')
  assert.ok(lines[1]!.startsWith(' '))
  assert.doesNotMatch(lines[1]!, /\(/)
})
