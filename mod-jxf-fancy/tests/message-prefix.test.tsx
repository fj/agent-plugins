import { expect, test } from 'claude-code/testing'

import {
  appendReply,
  ENGINE_TEXT,
  LIVE_SURFACES,
  MODEL,
  PLUGIN,
  runTool,
  shownRows,
  shownText,
  step,
  submit,
  textReply,
  toolReply,
  USAGE,
  world,
} from './world.tsx'

const REPLY = 'Here is the plan.'
const ROW = { text: REPLY, isFirstOfReply: true }
const STEP_MS = 3000
const OTHER_MODEL_USAGE = {
  input_tokens: 100,
  output_tokens: 10,
  cache_read_input_tokens: 0,
  cache_creation_input_tokens: 0,
  model: 'gpt-9',
}

test('the first row of a reply gets a prefix that fills in when usage arrives', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY))

  const stream = $.turn.step({ turnId: 'turn-1', index: 0, model: MODEL, messageCount: 1 })
  await stream.next()
  await appendReply($, 'reply-1', REPLY)

  const drawings = await Promise.all(
    LIVE_SURFACES.map(surface =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'AssistantMessage', props: ROW, requestId: 'reply-1' }),
    ),
  )

  for (const ui of drawings) {
    const tree = await ui.drawn()
    expect(shownRows(tree).slice(0, 2)).toEqual([' ', '{2026-10-03 04:20:37 Δ 0.0s} {turn 1.1}'])
    expect(shownText(tree)).not.toContain('$')
    expect(await ui.find({ type: 'Text', text: ENGINE_TEXT })).toBeDefined()
  }

  await w.clock.advance(STEP_MS)
  for await (const _chunk of stream) {
    void _chunk
  }

  for (const ui of drawings) {
    const text = shownText(await ui.drawn())
    expect(text).toContain('{2026-10-03 04:20:37 Δ 3.0s}')
    expect(text).toContain('{turn 1.1: ↑ Δ 1.2k + ⟲ 5.0k / 6.2k Σ ↓ Δ 300 / 300 Σ}')
    expect(text).toMatch(/\{Δ \$0\.\d\d \/ \$0\.\d\d Σ\}/)
  }
})

test('later rows of a reply and unknown rows get no prefix', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY))
  for await (const _chunk of $.turn.step({ turnId: 'turn-1', index: 0, model: MODEL, messageCount: 1 })) {
    void _chunk
  }

  for (const surface of LIVE_SURFACES) {
    const later = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'AssistantMessage',
      props: { ...ROW, isFirstOfReply: false },
    })
    expect(shownText(await later.drawn())).not.toContain('turn 1.1')
    const unknown = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'AssistantMessage',
      props: { ...ROW, text: 'never streamed' },
    })
    expect(shownText(await unknown.drawn())).not.toContain('turn')
  }
})

test('a reply row with no known id is matched by its streamed text', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY))
  for await (const _chunk of $.turn.step({ turnId: 'turn-1', index: 0, model: MODEL, messageCount: 1 })) {
    void _chunk
  }

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'AssistantMessage', props: ROW })
  expect(shownText(await ui.drawn())).toContain('{turn 1.1: ')
})

test('tool calls take a Y number between reply segments', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(toolReply('toolu_1'))
  for await (const _chunk of $.turn.step({ turnId: 'turn-1', index: 0, model: MODEL, messageCount: 1 })) {
    void _chunk
  }
  await runTool($, w)
  w.scripts.push(textReply(REPLY))
  for await (const _chunk of $.turn.step({ turnId: 'turn-1', index: 1, model: MODEL, messageCount: 2 })) {
    void _chunk
  }

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AssistantMessage', props: ROW })
  expect(shownText(await ui.drawn())).toContain('{turn 1.2: ')
})

test('a model without public pricing shows a lower bound', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY, OTHER_MODEL_USAGE))
  for await (const _chunk of $.turn.step({ turnId: 'turn-1', index: 0, model: 'gpt-9', messageCount: 1 })) {
    void _chunk
  }

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AssistantMessage', props: ROW })
  expect(shownText(await ui.drawn())).toContain('{Δ $0.00+ / $0.00+ Σ}')
})

test('subagent steps stay out of the ledger', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY))
  for await (const _chunk of $.turn.step({
    turnId: 'turn-1',
    index: 0,
    model: MODEL,
    messageCount: 1,
    agentId: 'agent-1',
  })) {
    void _chunk
  }

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AssistantMessage', props: ROW })
  expect(shownText(await ui.drawn())).not.toContain('turn')
})

test('a reply row keeps its prefix when the host draws other text for it', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY))
  await step($, 'turn-1', 0)
  await appendReply($, 'reply-1', REPLY)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { ...ROW, text: 'text the host rewrote' },
    requestId: 'reply-1',
  })
  expect(shownText(await ui.drawn())).toContain('{turn 1.1: ')
})

test('streamed pieces and later blocks each find their reply row', async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push({
    chunks: [
      { kind: 'text', index: 0, text: 'Here is ' },
      { kind: 'text', index: 0, text: 'the plan.' },
      { kind: 'text', index: 1, text: 'And a second block.' },
    ],
    usage: USAGE,
  })
  await step($, 'turn-1', 0)

  const first = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AssistantMessage', props: ROW })
  expect(shownText(await first.drawn())).toContain('{turn 1.1: ')
  const second = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AssistantMessage',
    props: { ...ROW, text: 'And a second block.' },
  })
  expect(shownText(await second.drawn())).toContain('{turn 1.2: ')
})

test('debug logs a reply row that matched nothing', { options: { debug: true } }, async ($, on) => {
  const w = world(on)

  await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'AssistantMessage',
    props: ROW,
    requestId: 'lost-reply',
  })

  expect(w.logs).toEqual(['mod-jxf-fancy: AssistantMessage row lost-reply matched nothing'])
})

test('a subagent reply row leaves the main reply its mark', { options: { debug: true } }, async ($, on) => {
  const w = world(on)
  await submit($, 'plan it')
  w.scripts.push(textReply(REPLY))
  await step($, 'turn-1', 0)
  await appendReply($, 'subagent-reply', REPLY, 'agent-1')
  await appendReply($, 'reply-1', REPLY)

  expect(w.logs).toEqual(['mod-jxf-fancy: response row reply-1 -> turn-1:0:0'])
})
