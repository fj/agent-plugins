import assert from 'node:assert/strict'
import { test } from 'node:test'

import { PALETTE } from '../src/render/palette.ts'
import { hasPulse, PULSE_PERIOD_MS as PERIOD_MS, roleColor } from '../src/render/pulse.ts'
import { seg } from '../src/render/segment.ts'

test('a pulsing role brightens to its palette color halfway through a pulse and dims at either end', () => {
  assert.equal(roleColor('overage', PERIOD_MS / 2), PALETTE.overage)
  assert.equal(roleColor('overage', 0), roleColor('overage', PERIOD_MS))
  assert.notEqual(roleColor('overage', 0), PALETTE.overage)
})

test('a pulsing role passes through a color between its dim and bright ends', () => {
  const between = roleColor('overage', PERIOD_MS / 4)

  assert.notEqual(between, roleColor('overage', 0))
  assert.notEqual(between, PALETTE.overage)
})

test('a pulse repeats every period', () => {
  assert.equal(roleColor('overage', PERIOD_MS * 1.5), roleColor('overage', PERIOD_MS / 2))
})

test('a pulsing role keeps its palette color with no moment to pulse at', () => {
  assert.equal(roleColor('overage'), PALETTE.overage)
})

test('a steady role keeps its palette color at every moment', () => {
  assert.equal(roleColor('meter', 0), PALETTE.meter)
  assert.equal(roleColor('meter', PERIOD_MS / 2), PALETTE.meter)
  assert.equal(roleColor('plain', 0), undefined)
})

test('a line pulses only when one of its parts has a pulsing role', () => {
  assert.equal(hasPulse([seg('5h', 'muted'), seg(' (!)', 'overage')]), true)
  assert.equal(hasPulse([seg('5h', 'muted')]), false)
})
