import assert from 'node:assert/strict'
import { test } from 'node:test'

import { progressWidget, titleWidget } from '../../../src/adapters/pi/widget.ts'
import { FRAME_MS } from '../../../src/render/progress.ts'
import { fit, plainTheme } from './fakes.ts'

const FRAMES = 3
const WIDTH = 20

test('the title sits at the right edge, one column in', () => {
  const [line] = titleWidget('Fix auth', plainTheme, fit).render(WIDTH)

  assert.equal(line, `${' '.repeat(WIDTH - 'Fix auth '.length)}Fix auth `)
})

test('a title wider than the line is cut to fit', () => {
  const [line] = titleWidget('A title far too long to fit', plainTheme, fit).render(WIDTH)

  assert.equal(line, 'A title far too long')
})

test('the progress line sits at the right edge', () => {
  const widget = progressWidget({ requestRender() {} }, plainTheme, fit, { modelLabel: 'm', startedAt: 0, now: () => 0 })
  const [line] = widget.render(WIDTH * FRAMES)
  widget.dispose()

  assert.equal(line!.length, WIDTH * FRAMES)
  assert.match(line!, /^ +\S asking m .* $/)
})

test('the progress widget redraws every frame until it is disposed', t => {
  t.mock.timers.enable({ apis: ['setInterval'] })
  let renders = 0
  const widget = progressWidget({ requestRender: () => void renders++ }, plainTheme, fit, { modelLabel: 'm', startedAt: 0, now: () => 0 })

  t.mock.timers.tick(FRAME_MS * FRAMES)
  assert.equal(renders, FRAMES)

  widget.dispose()
  t.mock.timers.tick(FRAME_MS * FRAMES)
  assert.equal(renders, FRAMES)
})
