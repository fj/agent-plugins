import { expect, test } from 'claude-code/testing'

import { LIVE_SURFACES, PLUGIN, submit, world } from './world.tsx'

const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 20,
  bodyColumns: 80,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

test('the top hat shows in a new session and hides after the first prompt', async ($, on) => {
  world(on)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'top-hat' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'mod-jxf-fancy-details is on' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '🎩 ' })).toBeDefined()
    await ui.unmount()
  }

  await submit($, 'hello')

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'top-hat' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the top hat yields to a survey', async ($, on) => {
  world(on)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({
      plugin: PLUGIN,
      surface,
      component: 'AbovePrompt',
      props: { ...BAND, hasSurvey: true },
    })
    expect(await ui.find({ key: 'top-hat' })).toBeUndefined()
    await ui.unmount()
  }
})

const RESUMED_TURNS = 3

test('the top hat stays hidden in a resumed session', async ($, on) => {
  world(on, { turns: RESUMED_TURNS })

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', props: BAND })
    expect(await ui.find({ key: 'top-hat' })).toBeUndefined()
    await ui.unmount()
  }
})
