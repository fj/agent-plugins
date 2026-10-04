import { expect, test } from 'claude-code/testing'

import { DONE_TIMER_COLOR, PALETTE } from '../src/render/palette.ts'
import { ENGINE_TEXT, LIVE_SURFACES, PLUGIN, shownColors, shownColumn, shownRows, shownText, submit, TOOL_MS, world } from './world.tsx'

const FRAME_STEPS_MS = 700
const toolRow = (id: string) => ({
  tool_use_id: id,
  tool: 'Bash',
  input: { command: 'ls' },
  isRunning: true,
  isErrored: false,
  isInterrupted: false,
})

test('a tool row shows a live timer while the call runs, then its duration in gray', async ($, on) => {
  const w = world(on)
  await submit($, 'list files')
  const call = $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.settle()
  const id = w.toolIds[0] ?? ''
  const timer = `tool-timer-${id}`

  const drawings = await Promise.all(
    LIVE_SURFACES.map(surface =>
      $.ui.mount({ plugin: PLUGIN, surface, component: 'ToolUse', props: toolRow(id), requestId: id }),
    ),
  )

  for (const ui of drawings) {
    const rows = shownColumn(await ui.drawn())?.children ?? []
    expect(rows[1]).toMatchObject({ children: [{ type: 'Client' }, { type: 'Text' }] })
    expect(shownText(rows[1])).toBe(' {turn 1.1}')
    expect(await ui.find({ type: 'Text', text: ENGINE_TEXT })).toBeDefined()
    expect(await ui.find({ type: 'Client', key: timer })).toBeDefined()
    await ui.advance(FRAME_STEPS_MS)
    expect(shownText(await ui.drawn({ in: timer }))).toBe('{2026-10-03 04:20:37 Δ 0.7s}')
  }

  await w.clock.advance(TOOL_MS)
  await call

  for (const ui of drawings) {
    expect(await ui.find({ type: 'Client' })).toBeUndefined()
    const done = await ui.find({ type: 'Text', text: '{2026-10-03 04:20:37 Δ 2.0s}' })
    expect(done?.props.color).toBe(DONE_TIMER_COLOR)
    const row = shownColumn(await ui.drawn())?.children?.[1]
    expect(shownText(row)).toBe('{2026-10-03 04:20:37 Δ 2.0s} {turn 1.1}')
    expect(shownColors(row)).toContain(PALETTE.label)
  }
})

test('vscode draws a running tool timer as static text', async ($, on) => {
  const w = world(on)
  await submit($, 'list files')
  const call = $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.settle()
  const id = w.toolIds[0] ?? ''

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'vscode',
    component: 'ToolUse',
    props: toolRow(id),
    requestId: id,
  })
  const timer = await ui.find({ type: 'Text', text: '{2026-10-03 04:20:37 Δ 0.0s}' })
  expect(timer?.props.color).toBe(PALETTE.time)
  expect(shownRows(await ui.drawn())[1]).toBe('{2026-10-03 04:20:37 Δ 0.0s} {turn 1.1}')

  await w.clock.advance(TOOL_MS)
  await call
})

test('unknown tool rows are left alone', async ($, on) => {
  world(on)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: toolRow('toolu_unknown'),
  })
  expect(shownText(await ui.drawn())).toBe(`ToolUse ${ENGINE_TEXT}`)
})

test('tool groups unfold so each call draws its own row', async ($, on) => {
  const seen: boolean[] = []
  on('ui.render', { component: 'ToolGroup' }, (_$, e, next) => {
    seen.push(e.props.isExpanded)

    return next(e)
  })
  world(on)

  for (const surface of ['terminal', 'desktop', 'vscode'] as const) {
    await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'ToolGroup',
      props: {
        calls: [{ tool: 'Read', input: {}, isRunning: false, isErrored: false, isInterrupted: false }],
        isActive: false,
        isExpanded: false,
      },
    })
  }

  expect(seen).toEqual([true, true, true])
})

test('debug logs a row that matched nothing once', { options: { debug: true } }, async ($, on) => {
  const w = world(on)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: toolRow('toolu_lost'),
    requestId: 'toolu_lost',
  })
  await ui.redraw()

  expect(w.logs).toEqual(['mod-jxf-fancy: ToolUse row toolu_lost matched nothing'])
})

test('a failed tool call stops its timer', async ($, on) => {
  const w = world(on, { isToolFailing: true })
  await submit($, 'list files')
  const failure = $.tool.call({ tool: 'Bash', command: 'ls' }).then(
    () => undefined,
    (error: unknown) => error,
  )
  await w.clock.settle()
  const id = w.toolIds[0] ?? ''
  await w.clock.advance(TOOL_MS)
  expect(await failure).toBeInstanceOf(Error)

  const ui = await $.ui.mount({
    plugin: PLUGIN,
    surface: 'terminal',
    component: 'ToolUse',
    props: toolRow(id),
    requestId: id,
  })
  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  const done = await ui.find({ type: 'Text', text: '{2026-10-03 04:20:37 Δ 2.0s}' })
  expect(done?.props.color).toBe(DONE_TIMER_COLOR)
})

test('subagent tool calls stay out of the ledger', async ($, on) => {
  const w = world(on)
  await submit($, 'list files')
  const subagentCall = { tool: 'Bash', command: 'ls', agentId: 'agent-1' } as Parameters<typeof $.tool.call>[0]
  const call = $.tool.call(subagentCall)
  await w.clock.advance(TOOL_MS)
  await call
  const id = w.toolIds[0] ?? ''

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'ToolUse', props: toolRow(id), requestId: id })
  expect(shownText(await ui.drawn())).toBe(`ToolUse ${ENGINE_TEXT}`)
})
