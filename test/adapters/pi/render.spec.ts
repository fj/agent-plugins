import assert from 'node:assert/strict'
import { test } from 'node:test'

import { alignRight, paint, paintLine, paintTimer } from '../../../src/adapters/pi/paint.ts'
import { patchToolRows, type ToolRow } from '../../../src/adapters/pi/tool-rows.ts'
import { seg } from '../../../src/render/segment.ts'
import { measure, plain } from './fakes.ts'

test('painting uses truecolor and leaves plain text alone', () => {
  assert.equal(paint('hi', '#ff8000'), '\x1b[38;2;255;128;0mhi\x1b[39m')
  assert.equal(paint('hi', undefined), 'hi')
  assert.equal(plain(paintLine([seg('a', 'cost'), seg('b')])), 'ab')
})

test('a live timer shimmers per character; a stopped one is a single gray run', () => {
  const live = paintTimer({ text: 'abc', isLive: true }, 0)
  const done = paintTimer({ text: 'abc', isLive: false }, 0)

  assert.equal(live.match(/\x1b\[38;2;/g)?.length, 3)
  assert.equal(done, '\x1b[38;2;138;138;138mabc\x1b[39m')
})

test('right alignment pads to the width and never overflows', () => {
  assert.equal(alignRight('abc', 6, measure), '   abc')
  assert.equal(alignRight('abcdef', 4, measure), 'abcd')
})

test('patched tool rows gain a timer line, shift mouse rows, and restore cleanly', () => {
  const seen: [number, number][] = []

  class Row {
    toolCallId = 't1'
    render(_width: number) {
      return ['', 'box']
    }
    handleMouse(event: { y: number; height: number }) {
      seen.push([event.y, event.height])

      return { handled: true }
    }
  }

  const unpatch = patchToolRows(Row.prototype, id => (id === 't1' ? 'TIMER' : undefined))
  const row = new Row() as ToolRow

  assert.deepEqual(row.render(10), ['', 'TIMER', 'box'])
  assert.equal(row.handleMouse?.({ y: 1, height: 3 }), undefined)
  row.handleMouse?.({ y: 0, height: 3 })
  row.handleMouse?.({ y: 2, height: 3 })
  assert.deepEqual(seen, [
    [0, 2],
    [1, 2],
  ])

  unpatch()
  assert.deepEqual(new Row().render(10), ['', 'box'])
})

test('rows without a timer or a gap render as before, and an inherited mouse handler is not shadowed after restore', () => {
  class Base {
    handleMouse() {
      return 'base'
    }
  }
  class Row extends Base {
    toolCallId = 't'
    render(_width: number) {
      return ['box']
    }
  }

  const unpatch = patchToolRows(Row.prototype, id => (id === 't' ? 'TIMER' : undefined))

  assert.deepEqual(new Row().render(10), ['TIMER', 'box'])
  assert.equal(Object.hasOwn(Row.prototype, 'handleMouse'), true)
  unpatch()
  assert.equal(Object.hasOwn(Row.prototype, 'handleMouse'), false)
  assert.equal(new Row().handleMouse(), 'base')
})
