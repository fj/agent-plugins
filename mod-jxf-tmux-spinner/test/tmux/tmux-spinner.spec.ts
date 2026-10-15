import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { after, test } from 'node:test'

const TMUX_DIR = join(import.meta.dirname, '..', '..', 'tmux')
const SPINNER = join(TMUX_DIR, 'tmux-spinner')
const CONF = join(TMUX_DIR, 'tmux-spinner.conf')
const SOCKET = `tmux-spinner-test-${process.pid}`
const BUSY_FRAMES = ['◐', '◓', '◑', '◒']

const spinner = (...args: string[]) => execFileSync(SPINNER, args, { encoding: 'utf8' })
const tmux = (...args: string[]) => execFileSync('tmux', ['-L', SOCKET, ...args], { encoding: 'utf8' }).trim()
const hasTmux = (() => {
  try {
    execFileSync('tmux', ['-V'])
    return true
  } catch {
    return false
  }
})()

test('busy prints one spinner frame', () => {
  assert.ok(BUSY_FRAMES.includes(spinner('busy')))
})

test('waiting and done print their marks', () => {
  assert.equal(spinner('waiting'), '#[fg=yellow,bold]?#[default]')
  assert.equal(spinner('done'), '#[fg=green]✓#[default]')
})

test('an unknown or missing state prints nothing', () => {
  assert.equal(spinner('bogus'), '')
  assert.equal(spinner(), '')
})

test('visiting a window clears done and waiting but not busy', { skip: !hasTmux && 'tmux is not installed' }, () => {
  after(() => tmux('kill-server'))
  tmux('-f', '/dev/null', 'new-session', '-d', '-s', 's')
  tmux('new-window', '-d', '-t', 's:1')
  tmux('new-window', '-d', '-t', 's:2')
  tmux('new-window', '-d', '-t', 's:3')
  tmux('source-file', CONF)

  const visit = (state: string, window: string) => {
    tmux('set-option', '-w', '-t', window, '@agent_state', state)
    tmux('select-window', '-t', window)
    return tmux('show-options', '-wqv', '-t', window, '@agent_state')
  }

  assert.equal(visit('done', 's:1'), '')
  assert.equal(visit('waiting', 's:2'), '')
  assert.equal(visit('busy', 's:3'), 'busy')
})

test('the badge runs the spinner next to the conf', { skip: !hasTmux && 'tmux is not installed' }, () => {
  after(() => tmux('kill-server'))
  tmux('-f', '/dev/null', 'new-session', '-d', '-s', 's')
  tmux('source-file', CONF)

  assert.equal(tmux('show-options', '-gqv', '@agent_spinner'), SPINNER)
})
