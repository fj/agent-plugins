import assert from 'node:assert/strict'
import { test } from 'node:test'

import { parseConfig, type TitleConfig } from '../../../src/config/config.ts'
import { modJxfSessionTitle } from '../../../src/adapters/pi/extension.ts'
import { DEFAULT_MODEL } from '../../../src/adapters/pi/config.ts'
import { fakeCtx, fakePi, memoryFiles, SIDECAR_FILE, fit, type CtxOptions, type SessionNames } from './fakes.ts'

const T0 = Date.UTC(2026, 9, 18, 4)
const ELAPSED_MS = 2345
const SHORT_TIMEOUT_MS = 5
const OTHER_SESSION = { sessionId: 'sess-2', sessionFile: '/sessions/2026_def.jsonl' }
const INSTRUCTIONS = parseConfig(null, DEFAULT_MODEL).instructions

type SetupOptions = { config?: Partial<TitleConfig>; sessionName?: string; files?: Record<string, string>; isStarted?: boolean } & CtxOptions

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>(done => (resolve = done))

  return { promise, resolve }
}

async function setup(options: SetupOptions = {}) {
  const names: SessionNames = { name: options.sessionName }
  const files = memoryFiles(options.files)
  let now = T0
  const load = (pi: ReturnType<typeof fakePi>) =>
    modJxfSessionTitle({
      configPath: '/agent/mod-jxf-session-title.json',
      files,
      fit,
      readConfig: () => ({ ...parseConfig(null, DEFAULT_MODEL), ...options.config }),
      now: () => now,
      newId: () => 'id-1',
    })(pi.api)
  const pi = fakePi(names)
  load(pi)
  const c = fakeCtx(options)

  if (options.isStarted !== false) {
    await pi.emit('session_start', { reason: 'startup' }, c.ctx)
  }

  async function switchSession(ctxOptions: CtxOptions = {}) {
    await pi.shutdown(c.ctx)
    c.invalidate()
    names.name = undefined
    const next = fakePi(names)
    load(next)
    const nextCtx = fakeCtx({ ...OTHER_SESSION, ...ctxOptions })
    await next.emit('session_start', { reason: 'new' }, nextCtx.ctx)

    return { pi: next, ...nextCtx }
  }

  return { pi, files, ...c, advance: (ms: number) => (now += ms), switchSession }
}

const firstPrompt = (prompt = 'fix the auth token refresh') => ({ messageType: 'user', prompt })

const fenced = (text: string) => `<request>\n${text}\n</request>`

test('the first prompt is titled by haiku on the current provider', async () => {
  const s = await setup()
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.equal(s.calls[0]?.model, 'claude-bridge/claude-haiku-5-5')
  assert.equal(s.calls[0]?.systemPrompt, INSTRUCTIONS)
  assert.equal(s.calls[0]?.prompt, fenced('fix the auth token refresh'))
  assert.equal(s.calls[0]?.options.maxTokens, 64)
  assert.equal(s.pi.name(), 'Fix auth refresh')
  assert.equal(s.shownLine(), 'Fix auth refresh ')
  assert.deepEqual(JSON.parse(s.files.all.get(SIDECAR_FILE)!), {
    title: 'Fix auth refresh',
    model: 'claude-bridge/claude-haiku-5-5',
    generatedAt: '2026-10-18T04:00:00.000Z',
  })
})

test('the line shows a spinner, the model and the elapsed time while it asks', async () => {
  const reply = deferred<{ text: string }>()
  const s = await setup({ reply: () => reply.promise })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)
  s.advance(ELAPSED_MS)

  assert.match(s.shownLine()!, /^ *\S asking claude-bridge\/claude-haiku-5-5 to summarize prompt for session title \[2\.3s\] $/)
  assert.equal(s.shownLine(30)?.length, 30)

  reply.resolve({ text: 'Fix auth refresh' })
  await s.pi.emit('session_info_changed', { name: 'Fix auth refresh' }, s.ctx)
  assert.equal(s.shownLine(), 'Fix auth refresh ')
})

test('a second prompt while the first is still being titled asks only once', async () => {
  const reply = deferred<{ text: string }>()
  const s = await setup({ reply: () => reply.promise })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)
  await s.pi.emit('before_agent_start', firstPrompt('and add tests'), s.ctx)
  reply.resolve({ text: 'Fix auth refresh' })
  await s.pi.emit('session_info_changed', { name: 'Fix auth refresh' }, s.ctx)

  assert.equal(s.calls.length, 1)
})

test('a named session is not titled again', async () => {
  const s = await setup({ sessionName: 'My name' })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.deepEqual(s.calls, [])
})

test('a custom message run is not titled', async () => {
  const s = await setup()
  await s.pi.emit('before_agent_start', { messageType: 'custom', message: {} }, s.ctx)

  assert.deepEqual(s.calls, [])
})

test('the model and provider come from the config', async () => {
  const s = await setup({ config: { model: 'anthropic/claude-haiku-4-5' }, models: ['anthropic/claude-haiku-4-5'] })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.equal(s.calls[0]?.model, 'anthropic/claude-haiku-4-5')
})

test('a model the provider lacks warns and names nothing', async () => {
  const s = await setup({ provider: 'openai' })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.deepEqual(s.notices, ['session-title: model openai/claude-haiku-5-5 is not available'])
  assert.equal(s.pi.name(), undefined)
})

test('a failed request warns with the provider error', async () => {
  const s = await setup({ reply: { stopReason: 'error', errorMessage: 'overloaded' } })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.deepEqual(s.notices, ['session-title: overloaded'])
  assert.equal(s.shownLine(), undefined)
})

test('a request that outlives the configured timeout is aborted and warns', async () => {
  const s = await setup({ config: { timeoutMs: SHORT_TIMEOUT_MS }, reply: () => new Promise(() => {}) })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)
  await new Promise(resolve => setTimeout(resolve, SHORT_TIMEOUT_MS * 4))
  await s.pi.emit('session_info_changed', { name: undefined }, s.ctx)

  assert.deepEqual(s.notices, ['session-title: title request aborted'])
  assert.equal(s.pi.name(), undefined)
  assert.equal(s.files.all.size, 0)
})

test('the command regenerates the title from every user prompt', async () => {
  const branch = [
    { type: 'message', message: { role: 'user', content: 'fix auth' } },
    { type: 'message', message: { role: 'assistant', content: [{ type: 'text', text: 'done' }] } },
    { type: 'message', message: { role: 'user', content: [{ type: 'text', text: 'now add tests' }] } },
  ]
  const s = await setup({ sessionName: 'Old', branch, reply: { text: 'Auth fix and tests' } })
  await s.pi.command('session-title', s.ctx)

  assert.equal(s.calls[0]?.prompt, fenced('fix auth\n\nnow add tests'))
  assert.equal(s.pi.name(), 'Auth fix and tests')
})

test('a session start shows the name ahead of a different sidecar title', async () => {
  const sidecar = JSON.stringify({ title: 'From sidecar', model: 'm', generatedAt: '2026-10-18T04:00:00.000Z' })
  const s = await setup({ sessionName: 'My name', files: { [SIDECAR_FILE]: sidecar } })

  assert.equal(s.shownLine(), 'My name ')
  assert.equal(s.pi.name(), 'My name')
})

test('a session with a sidecar title but no name takes the title as its name', async () => {
  const sidecar = JSON.stringify({ title: 'Saved after leaving', model: 'm', generatedAt: '2026-10-18T04:00:00.000Z' })
  const s = await setup({ files: { [SIDECAR_FILE]: sidecar } })

  assert.equal(s.pi.name(), 'Saved after leaving')
  assert.equal(s.shownLine(), 'Saved after leaving ')
  assert.deepEqual(s.calls, [])
})

test('a rename shows the new name', async () => {
  const s = await setup()
  await s.pi.emit('session_info_changed', { name: 'Renamed' }, s.ctx)

  assert.equal(s.shownLine(), 'Renamed ')
})

test('a session with no file is titled but writes no sidecar', async () => {
  const s = await setup({ sessionFile: undefined })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.equal(s.pi.name(), 'Fix auth refresh')
  assert.equal(s.files.all.size, 0)
})

test('without a UI the session is still named but nothing is drawn', async () => {
  const s = await setup({ hasUI: false })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.equal(s.pi.name(), 'Fix auth refresh')
  assert.equal(s.widgetCount(), 0)
})

test('a title that arrives after a session switch goes to the old session only, without touching the stale runtime', async t => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown) => void rejections.push(reason)
  process.on('unhandledRejection', onRejection)
  t.after(() => void process.off('unhandledRejection', onRejection))

  const reply = deferred<{ text: string }>()
  const s = await setup({ reply: () => reply.promise })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)
  const next = await s.switchSession()

  reply.resolve({ text: 'Fix auth refresh' })
  await next.pi.emit('session_info_changed', { name: undefined }, next.ctx)

  assert.equal(JSON.parse(s.files.all.get(SIDECAR_FILE)!).title, 'Fix auth refresh')
  assert.equal(next.pi.name(), undefined)
  assert.equal(next.shownLine(), undefined)
  assert.deepEqual(next.notices, [])
  assert.deepEqual(rejections, [])
})

test('a new session titles its first prompt while the old one is still pending', async () => {
  const s = await setup({ reply: () => new Promise(() => {}) })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)
  const next = await s.switchSession({ reply: { text: 'Second session' } })
  await next.pi.emit('before_agent_start', firstPrompt('write the docs'), next.ctx)

  assert.equal(next.pi.name(), 'Second session')
  assert.equal(next.shownLine(), 'Second session ')
})

test('a session that starts unannounced is still titled', async () => {
  const s = await setup({ isStarted: false })
  await s.pi.emit('before_agent_start', firstPrompt(), s.ctx)

  assert.equal(s.pi.name(), 'Fix auth refresh')
})
