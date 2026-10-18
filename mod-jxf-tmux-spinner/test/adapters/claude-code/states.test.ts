import type { On } from 'claude-code'
import { expect, mock, test, type Engine } from 'claude-code/testing'

const PANE = '%3'
const TMUX = '/tmp/tmux-1000/default,1,0'
const SESSION_ID = 's1'

type State = string | undefined

function world($: Engine, on: On, env: Record<string, string> = { TMUX, TMUX_PANE: PANE }) {
  const w = {
    states: [] as State[],
    identities: [] as string[][],
    statesInTool: [] as State[],
    dialog: undefined as 'permission' | 'elicitation' | undefined,
  }

  mock.env(on, env)
  on('session.id', () => ({ value: SESSION_ID }))
  on('process.run', (_$, e) => {
    const isUnset = e.argv.includes('-wu')
    expect(e.argv.slice(0, 2)).toEqual(['tmux', 'set-option'])
    expect(e.argv[e.argv.indexOf('-t') + 1]).toBe(PANE)
    if (e.argv.includes('@agent_state')) w.states.push(isUnset ? undefined : e.argv.at(-1))
    else w.identities.push(e.argv)

    return { value: { exitCode: 0, stdout: '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false } }
  })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('classic.PermissionRequest', () => ({}))
  on('classic.Elicitation', () => ({}))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('tool.call', async (_$, e) => {
    if (w.dialog === 'permission') {
      await $.classic.PermissionRequest({ tool_name: e.tool, tool_input: {} })
    }

    if (w.dialog === 'elicitation') {
      await $.classic.Elicitation({ mcp_server_name: 'docs', message: 'Sign in' })
    }

    w.statesInTool.push(w.states.at(-1))
    return { result: {}, text: 'ok' }
  })

  return w
}

const complete = ($: Engine, answer: string, agentId?: string) =>
  $.turn.complete({ answer, durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...(agentId && { agentId }) })

test('a turn is busy, then done', async ($, on) => {
  const w = world($, on)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await complete($, 'All done.')
  expect(w.states).toEqual(['busy', 'done'])
})

test('a turn that ends with a question is waiting', async ($, on) => {
  const w = world($, on)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await complete($, 'Shall I go on?')
  expect(w.states).toEqual(['busy', 'waiting'])
})

test('a subagent turn does not end the state', async ($, on) => {
  const w = world($, on)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await complete($, 'Found it.', 'agent-1')
  expect(w.states).toEqual(['busy'])
})

test('a question tool is waiting until it is answered', async ($, on) => {
  const w = world($, on)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'AskUserQuestion', questions: [] } as never)
  expect(w.statesInTool).toEqual(['waiting'])
  expect(w.states).toEqual(['busy', 'waiting', 'busy'])
})

test('a permission dialog is waiting until it is answered', async ($, on) => {
  const w = world($, on)
  w.dialog = 'permission'
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(w.statesInTool).toEqual(['waiting'])
  expect(w.states).toEqual(['busy', 'waiting', 'busy'])
})

test('a tool with no dialog leaves the state alone', async ($, on) => {
  const w = world($, on)
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(w.states).toEqual(['busy'])
})

test('outside tmux nothing runs', async ($, on) => {
  const w = world($, on, {})
  await $.turn.start({ text: 'go', turnId: 't1' })
  await complete($, 'All done.')
  expect(w.states).toEqual([])
})

test('an MCP elicitation is waiting until it is answered', async ($, on) => {
  const w = world($, on)
  w.dialog = 'elicitation'
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls' })
  expect(w.statesInTool).toEqual(['waiting'])
  expect(w.states).toEqual(['busy', 'waiting', 'busy'])
})

test('the state is cleared when a session starts and ends', async ($, on) => {
  const w = world($, on)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  await $.session.end({ reason: 'other', sessionId: 's1' } as never)
  expect(w.states).toEqual([undefined, undefined])
})

test('a session names its harness and id until it ends', async ($, on) => {
  const w = world($, on)
  await $.session.start({ source: 'startup', cwd: '/work' } as never)
  await $.session.end({ reason: 'other', sessionId: SESSION_ID } as never)
  expect(w.identities).toEqual([
    ['tmux', 'set-option', '-w', '-t', PANE, '@agent_harness', 'claude', ';', 'set-option', '-w', '-t', PANE, '@agent_session', SESSION_ID],
    ['tmux', 'set-option', '-wu', '-t', PANE, '@agent_harness', ';', 'set-option', '-wu', '-t', PANE, '@agent_session'],
  ])
})
