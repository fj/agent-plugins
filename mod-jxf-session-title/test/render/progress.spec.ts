import assert from 'node:assert/strict'
import { test } from 'node:test'

import { FRAME_MS, progressText, SPINNER_FRAMES, spinnerFrame } from '../../src/render/progress.ts'

test('the progress text names the model and the elapsed seconds', () => {
  assert.equal(
    progressText('claude-bridge/claude-haiku-5-5', 2345),
    'asking claude-bridge/claude-haiku-5-5 to summarize prompt for session title [2.3s]',
  )
})

test('the progress text never counts below zero', () => {
  assert.match(progressText('m', -50), /\[0\.0s\]$/)
})

test('the spinner steps one frame per frame time and wraps', () => {
  assert.equal(spinnerFrame(0), SPINNER_FRAMES[0])
  assert.equal(spinnerFrame(FRAME_MS), SPINNER_FRAMES[1])
  assert.equal(spinnerFrame(FRAME_MS * SPINNER_FRAMES.length), SPINNER_FRAMES[0])
})
