import { expect, test } from 'claude-code/testing'

import { DONE_TIMER_COLOR } from '../src/render/palette.ts'
import {
  appendPrompt,
  ENGINE_TEXT,
  LIVE_SURFACES,
  PLUGIN,
  shownColors,
  shownText,
  step,
  submit,
  textReply,
  toolReply,
  world,
} from './world.tsx'

const TEXT = 'make it fancy'
const ROW = { text: TEXT, origin: { kind: 'composer' as const }, isExpanded: false }
const PROMPT_TIMER = 'prompt-timer-prompt-1'
const FIRST_REPLY_MS = 1500
const FRAME_STEPS_MS = 500

test('a prompt row shows a live shimmering timer until the first reply', async ($, on) => {
  const w = world(on)
  await submit($, TEXT)
  await appendPrompt($, 'row-1', TEXT)

  const drawings = await Promise.all(
    LIVE_SURFACES.map(surface =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'UserMessage', props: ROW, requestId: 'row-1' }),
    ),
  )

  for (const ui of drawings) {
    expect(await ui.find({ type: 'Text', text: ENGINE_TEXT })).toBeDefined()
    expect(await ui.find({ type: 'Client', key: PROMPT_TIMER })).toBeDefined()

    const first = await ui.drawn({ in: PROMPT_TIMER })
    expect(shownText(first)).toBe('{2026-10-03 04:20:37 Δ 0.0s}')
    await ui.advance(FRAME_STEPS_MS)
    const later = await ui.drawn({ in: PROMPT_TIMER })
    expect(shownText(later)).toBe('{2026-10-03 04:20:37 Δ 0.5s}')
    expect(new Set(shownColors(later)).size).toBeGreaterThan(1)
    expect(shownColors(later)).not.toEqual(shownColors(first))
  }

  await w.clock.advance(FIRST_REPLY_MS)
  w.scripts.push(textReply('On it.'))
  await step($, 'turn-1', 0)

  for (const ui of drawings) {
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
    const done = await ui.find({ type: 'Text', text: '{2026-10-03 04:20:37 Δ 1.5s}' })
    expect(done?.props.color).toBe(DONE_TIMER_COLOR)
  }
})

test('a tool call counts as the first reply', async ($, on) => {
  const w = world(on)
  await submit($, TEXT)
  await w.clock.advance(FIRST_REPLY_MS)
  w.scripts.push(toolReply('toolu_1'))
  await step($, 'turn-1', 0)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', props: ROW })
  expect(await ui.find({ type: 'Text', text: 'Δ 1.5s}' })).toBeDefined()
})

test('a prompt row without a known id is matched by its text', async ($, on) => {
  world(on)
  await submit($, 'first')
  await submit($, TEXT)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'UserMessage', props: ROW, requestId: 'unseen' })
    expect(await ui.find({ type: 'Client', key: 'prompt-timer-prompt-2' })).toBeDefined()
    await ui.unmount()
  }
})

test('vscode draws the prompt timer as static text', async ($, on) => {
  world(on)
  await submit($, TEXT)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'UserMessage', props: ROW })
  expect(await ui.find({ type: 'Text', text: '{2026-10-03 04:20:37 Δ 0.0s}' })).toBeDefined()
})

test('rows that are not user prompts are left alone', async ($, on) => {
  world(on)
  await submit($, TEXT)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'UserMessage',
    props: { ...ROW, origin: { kind: 'task-notification' } },
  })
  expect(await ui.find({ type: 'Text', text: 'Δ' })).toBeUndefined()
})

test('debug logs how a prompt row was matched', { options: { debug: true } }, async ($, on) => {
  const w = world(on)
  await submit($, TEXT)
  await appendPrompt($, 'row-1', TEXT)

  expect(w.logs).toContain('mod-jxf-fancy: prompt row row-1 -> prompt-1')
})

test('a prompt row keeps its timer when the host draws other text for it', async ($, on) => {
  world(on)
  await submit($, TEXT)
  await appendPrompt($, 'row-1', TEXT)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'UserMessage',
    props: { ...ROW, text: 'pasted text the host shows differently' },
    requestId: 'row-1',
  })
  expect(await ui.find({ type: 'Client', key: PROMPT_TIMER })).toBeDefined()
})

test('the live timer restarts its count when the host redraws the row', async ($, on) => {
  const w = world(on)
  await submit($, TEXT)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', props: ROW })
  await ui.advance(FRAME_STEPS_MS)
  await w.clock.advance(FIRST_REPLY_MS)
  await ui.redraw()

  expect(shownText(await ui.drawn({ in: PROMPT_TIMER }))).toBe('{2026-10-03 04:20:37 Δ 1.5s}')
})

test('debug logs a prompt row that matched nothing', { options: { debug: true } }, async ($, on) => {
  const w = world(on)

  await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'UserMessage', props: ROW, requestId: 'lost-row' })

  expect(w.logs).toEqual(['mod-jxf-fancy: UserMessage row lost-row matched nothing'])
})
