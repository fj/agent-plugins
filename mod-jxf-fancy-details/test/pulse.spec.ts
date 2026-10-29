import assert from 'node:assert/strict'
import { test } from 'node:test'

import { BACKGROUND, PALETTE } from '../src/render/palette.ts'
import { hasPulse, PULSE_PERIOD_MS as PERIOD_MS, pulseClock, roleBackground, roleColor } from '../src/render/pulse.ts'
import { seg } from '../src/render/segment.ts'

test('a pulsing role starts at its palette color, dims halfway through a pulse, and brightens again', () => {
  assert.equal(roleColor('overage', 0), PALETTE.overage)
  assert.equal(roleColor('overage', PERIOD_MS), PALETTE.overage)
  assert.notEqual(roleColor('overage', PERIOD_MS / 2), PALETTE.overage)
})

test('a pulsing role passes through a color between its dim and bright ends', () => {
  const between = roleColor('overage', PERIOD_MS / 4)

  assert.notEqual(between, roleColor('overage', PERIOD_MS / 2))
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

test('warning background starts bright and dims halfway through pulse', () => {
  assert.equal(roleBackground('warning', 0), BACKGROUND.warning)
  assert.notEqual(roleBackground('warning', PERIOD_MS / 2), BACKGROUND.warning)
})

test('warning background passes between dim and bright ends', () => {
  const between = roleBackground('warning', PERIOD_MS / 4)

  assert.notEqual(between, roleBackground('warning', PERIOD_MS / 2))
  assert.notEqual(between, BACKGROUND.warning)
})

test('warning background keeps bright color with no moment to pulse at', () => {
  assert.equal(roleBackground('warning'), BACKGROUND.warning)
})

test('warning background stops pulsing after few seconds and stays bright', () => {
  const settled = PERIOD_MS * 10 + PERIOD_MS / 2

  assert.equal(roleBackground('warning', settled), BACKGROUND.warning)
  assert.equal(hasPulse([seg('⚠', 'warning')], settled), false)
})

test('extra usage mark pulses for as long as it shows', () => {
  const later = PERIOD_MS * 1000

  assert.equal(hasPulse([seg(' (!)', 'overage')], later), true)
})

test('warning foreground stays at palette color at every moment', () => {
  assert.equal(roleColor('warning', 0), PALETTE.warning)
  assert.equal(roleColor('warning', PERIOD_MS / 2), PALETTE.warning)
})

test('role with no background has none at any moment', () => {
  assert.equal(roleBackground('overage', 0), undefined)
  assert.equal(roleBackground('path'), undefined)
})

test('line pulses when one of its parts has pulsing background', () => {
  assert.equal(hasPulse([seg('⚠', 'warning'), seg(' '), seg('~', 'path')]), true)
})

test('pulse clock counts from first moment of each epoch', () => {
  const elapsed = pulseClock()

  assert.equal(elapsed('/home/j', 1000), 0)
  assert.equal(elapsed('/home/j', 1500), 500)
  assert.equal(elapsed('/', 2000), 0)
  assert.equal(elapsed('/', 2300), 300)
})
