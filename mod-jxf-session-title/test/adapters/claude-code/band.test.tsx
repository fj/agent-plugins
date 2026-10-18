import { expect, test } from 'claude-code/testing'

import { BAND, ENGINE_TEXT, PLUGIN, shownText, sidecar, SIDECAR, startSession, submit, world } from './world.tsx'

const PROGRESS_KEY = 'session-title-progress'
const FRAME_STEPS_MS = 400

test('an untitled session leaves the band to the others', async ($, on) => {
  const w = world(on)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })

  expect(shownText(await ui.drawn())).toBe(`AbovePrompt ${ENGINE_TEXT}`)
})

test('the title sits at the bottom left with the others drawn to its right', async ($, on) => {
  const w = world(on, { files: { [SIDECAR]: sidecar('Fix auth refresh') } })
  await startSession($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  const band = await ui.find({ key: 'session-title' })

  expect(band?.props).toMatchObject({ width: BAND.bodyColumns })
  expect(shownText(await ui.drawn())).toBe(`Fix auth refreshAbovePrompt ${ENGINE_TEXT}`)
  expect(await ui.find({ type: 'Text', text: 'Fix auth refresh' })).toBeDefined()
})

test('a survey hides the title', async ($, on) => {
  const w = world(on, { files: { [SIDECAR]: sidecar('Fix auth refresh') } })
  await startSession($)
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: { ...BAND, hasSurvey: true } })

  expect(shownText(await ui.drawn())).toBe(`AbovePrompt ${ENGINE_TEXT}`)
})

test('while it asks, the band shows a spinner, the model and the time, then the title', async ($, on) => {
  const w = world(on)
  let answer: (text: string) => void = () => {}
  w.replies.push(() => new Promise(resolve => (answer = resolve)))
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'AbovePrompt', props: BAND })
  await submit($, w, 'fix the auth token refresh')

  expect(await ui.find({ type: 'Client', key: PROGRESS_KEY })).toBeDefined()
  expect(shownText(await ui.drawn({ in: PROGRESS_KEY }))).toMatch(
    /^\S asking anthropic\/haiku to summarize prompt for session title \[0\.0s\]$/,
  )
  await ui.advance(FRAME_STEPS_MS)
  expect(shownText(await ui.drawn({ in: PROGRESS_KEY }))).toMatch(/\[0\.4s\]$/)

  answer('Fix auth refresh')
  await w.clock.advance(1)

  expect(await ui.find({ type: 'Client' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Fix auth refresh' })).toBeDefined()
})
