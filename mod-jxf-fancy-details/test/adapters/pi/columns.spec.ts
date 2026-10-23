import assert from 'node:assert/strict'
import { test } from 'node:test'

import { besideRight, COLUMN_GAP, MIN_LEFT_WIDTH } from '../../../src/adapters/pi/columns.ts'
import { measure, plain } from './fakes.ts'

const WIDTH = 30
const DIM = '\x1b[2m'
const RESET = '\x1b[0m'

const shown = (left: string, rights: string[], width = WIDTH) => besideRight(left, rights, width, measure).map(plain)

test('without left text, every row aligns right', () => {
  assert.deepEqual(shown('', ['abc', 'de'], 6), ['   abc', '    de'])
})

test('left text wraps in a column beside the widest right row', () => {
  assert.deepEqual(shown('aaaa bbbb cccc dddddd', ['right-head', 'r2', 'r3']), [
    'aaaa bbbb cccc      right-head',
    'dddddd                      r2',
    '                            r3',
  ])
})

test('the left column is the width less the widest right row and the gap', () => {
  const right = 'r'.repeat(10)
  const leftWidth = WIDTH - right.length - COLUMN_GAP
  const fits = 'a'.repeat(leftWidth)

  assert.deepEqual(shown(`${fits} b`, [right, 'r']), [`${fits}  ${right}`, `b${' '.repeat(WIDTH - 2)}r`])
})

test('left rows past the last right row keep the left column', () => {
  assert.deepEqual(shown('aaaaaaaaaa bbbbbbbbbb cccc', ['right-head']), [
    'aaaaaaaaaa          right-head',
    'bbbbbbbbbb cccc',
  ])
})

test('the left column sits beside the rows down to its minimum width, and goes above them below it', () => {
  const atMinimum = 'r'.repeat(WIDTH - MIN_LEFT_WIDTH - COLUMN_GAP)
  const belowMinimum = `${atMinimum}r`

  assert.deepEqual(shown('aaaa bbbb', [atMinimum]), [`aaaa bbbb${' '.repeat(WIDTH - 9 - atMinimum.length)}${atMinimum}`])
  assert.deepEqual(shown('aaaa bbbb', [belowMinimum]), ['aaaa bbbb', belowMinimum.padStart(WIDTH)])
})

test('a left word wider than the column breaks across rows instead of overflowing', () => {
  const rows = shown('a'.repeat(20), ['right-head'])

  assert.deepEqual(rows, ['aaaaaaaaaaaaaaaaaa  right-head', 'aa'])
})

test('a right row as wide as the width puts the left text above every row', () => {
  const full = 'r'.repeat(WIDTH)

  assert.deepEqual(shown('aaaa bbbb', [full, 'r2']), ['aaaa bbbb', full, 'r2'.padStart(WIDTH)])
})

test('left text keeps its style on every wrapped row, and each left row ends its style before what follows', () => {
  const rows = besideRight(`${DIM}dim words that wrap onto a third row`, ['right-head', 'r2'], WIDTH, measure)

  assert.match(rows[0]!, /^\x1b\[2mdim .*\x1b\[0m +right-head$/)
  assert.ok(rows.slice(1).every(row => row.startsWith(DIM) && /^[^\x1b]*\x1b\[2m[^\x1b]*\x1b\[0m/.test(row)), JSON.stringify(rows))
})

test('the fake wrap carries the active style onto later lines and keeps styles inside broken words', () => {
  assert.deepEqual(measure.wrapTextWithAnsi(`${DIM}aaaa bbbb${RESET} cc`, 4), [`${DIM}aaaa`, `${DIM}bbbb${RESET}`, 'cc'])
  assert.deepEqual(measure.wrapTextWithAnsi(`${DIM}aaaaaa`, 4), [`${DIM}aaaa`, `${DIM}aa`])
})
