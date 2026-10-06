import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { CWD, ENGINE_TEXT, LIVE_SURFACES, MODEL, PLUGIN, shownRows, shownText, submit, world } from './world.tsx'

const ABOVE = { options: { footerPlacement: 'abovePrompt', showCachedInput: false } }
const BELOW = { options: { footerPlacement: 'belowPrompt', showCachedInput: false } }
const BODY_COLUMNS = 96
const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 20,
  bodyColumns: BODY_COLUMNS,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}
const HEAD = `${MODEL} · ~/src/projects/fancy`
const TOTALS = ['session $0.00 ↑0 ↓0', 'today $0.00 ↑0 ↓0']
const METERS = 'ctx 200.0k'

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
}

async function modeRows($: Engine, surface: (typeof LIVE_SURFACES)[number]): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'SessionMode', props: { modes: ['focus'] } })
  const rows = shownRows(await ui.drawn())
  await ui.unmount()

  return rows
}

test('below the prompt, the mode line holds every footer row', BELOW, async ($, on) => {
  world(on)
  await start($)

  for (const surface of LIVE_SURFACES) {
    expect(await modeRows($, surface)).toEqual([HEAD, ...TOTALS, METERS])
  }
})

test('below the prompt, the band draws no footer rows', BELOW, async ($, on) => {
  world(on)
  await start($)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(shownText(await ui.drawn())).toBe(`AbovePrompt ${ENGINE_TEXT}`)
})

test('an unknown placement keeps the footer below the prompt', { options: { footerPlacement: 'sideways', showCachedInput: false } }, async ($, on) => {
  world(on)
  await start($)
  await submit($, 'hello')

  expect(await modeRows($, 'terminal')).toEqual([HEAD, ...TOTALS, METERS])

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  expect(await ui.find({ key: 'footer-rows' })).toBeUndefined()
})

test('above the prompt, the mode line is one row with the head only', ABOVE, async ($, on) => {
  world(on)
  await start($)

  for (const surface of LIVE_SURFACES) {
    expect(await modeRows($, surface)).toEqual([HEAD])
  }
})

test('above the prompt, the band draws the totals and meters right-aligned across its width', ABOVE, async ($, on) => {
  world(on)
  await start($)
  await submit($, 'hello')

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
    const rows = await ui.find({ key: 'footer-rows' })
    expect(rows?.props).toMatchObject({ alignItems: 'flex-end', width: BODY_COLUMNS })
    expect(shownRows(rows)).toEqual([...TOTALS, METERS])
    await ui.unmount()
  }
})

test('above the prompt, the band yields to a survey', ABOVE, async ($, on) => {
  world(on)
  await start($)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } })
    expect(shownText(await ui.drawn())).toBe(`AbovePrompt ${ENGINE_TEXT}`)
    await ui.unmount()
  }
})

test(
  'above the prompt, the footer options combine the totals and hide the meters',
  { ...ABOVE, options: { ...ABOVE.options, combineTotals: true, showSubscription: false, showContext: false } },
  async ($, on) => {
    world(on)
    await start($)

    expect(await modeRows($, 'terminal')).toEqual([HEAD])

    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
    expect(shownRows(await ui.find({ key: 'footer-rows' }))).toEqual([TOTALS.join('  ')])
  },
)
