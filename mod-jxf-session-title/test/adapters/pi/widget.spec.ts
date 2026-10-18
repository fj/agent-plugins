import assert from 'node:assert/strict'
import { test } from 'node:test'

import { progressWidget } from '../../../src/adapters/pi/widget.ts'
import { FRAME_MS } from '../../../src/render/progress.ts'
import { plainTheme, truncate } from './fakes.ts'

const FRAMES = 3

test('the progress widget redraws every frame until it is disposed', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let renders = 0
  const widget = progressWidget({ requestRender: () => void renders++ }, plainTheme, truncate, { modelLabel: 'm', startedAt: 0, now: () => 0 })

  t.mock.timers.tick(FRAME_MS * FRAMES)
  assert.equal(renders, FRAMES)

  widget.dispose()
  t.mock.timers.tick(FRAME_MS * FRAMES)
  assert.equal(renders, FRAMES)
})
