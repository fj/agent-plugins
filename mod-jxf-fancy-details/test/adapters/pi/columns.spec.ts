import assert from 'node:assert/strict'
import { test } from 'node:test'

import { besideRight } from '../../../src/adapters/pi/columns.ts'
import { measure } from './fakes.ts'

const WIDTH = 20
const COLUMN_GAP = 2

test('without left items, every row aligns right', () => {
  assert.deepEqual(besideRight([], ['abc', 'de'], WIDTH, measure), ['                 abc', '                  de'])
})

test('left items share the first rows that have room for them, in order', () => {
  const rights = ['right-head-1', 'r2', 'r3']

  assert.deepEqual(besideRight(['aaaa', 'bbbbbbb', 'c'], rights, WIDTH, measure), [
    'aaaa    right-head-1',
    'bbbbbbb c         r2',
    '                  r3',
  ])
})

test('a left item fits beside its row with exactly the column gap to spare, and not with less', () => {
  const left = 'abcd'
  const right = 'r'.repeat(WIDTH - left.length - COLUMN_GAP)
  const wider = `${right}r`

  assert.deepEqual(besideRight([left], [right], WIDTH, measure), [`${left}${' '.repeat(COLUMN_GAP)}${right}`])
  assert.deepEqual(besideRight([left], [wider], WIDTH, measure), [left, wider.padStart(WIDTH)])
})

test('left items that cannot all fit beside the rows go on one line above them', () => {
  const rights = ['right-is-long-17', 'right-also-long-1']

  assert.deepEqual(besideRight(['aaaa', 'bb'], rights, WIDTH, measure), [
    'aaaa bb',
    '    right-is-long-17',
    '   right-also-long-1',
  ])
})

test('the line above the rows is cut to the width', () => {
  assert.deepEqual(besideRight(['a'.repeat(WIDTH * 2)], ['r'], WIDTH, measure)[0], 'a'.repeat(WIDTH))
})
