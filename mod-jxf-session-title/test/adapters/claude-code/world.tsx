import type { On, SessionMessage } from 'claude-code'
import { mock, type Engine, type MockClock } from 'claude-code/testing'

export const PLUGIN = 'mod-jxf-session-title'
export const TRANSCRIPT = '/home/tester/.claude/projects/-work/sess-1.jsonl'
export const SIDECAR = '/home/tester/.claude/projects/-work/sess-1.session-title.json'
export const OTHER_TRANSCRIPT = '/home/tester/.claude/projects/-work/sess-2.jsonl'
export const OTHER_SIDECAR = '/home/tester/.claude/projects/-work/sess-2.session-title.json'
export const T0 = Date.UTC(2026, 9, 18, 4)
export const ENGINE_TEXT = 'drawn by the engine'
export const BAND = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 20,
  bodyColumns: 96,
  scroll: { offset: 0, bodyRows: 20 },
  view: {},
}

const USAGE = { input_tokens: 40, output_tokens: 6, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }

export type Reply = string | { reason: 'empty-reply' | 'aborted' } | (() => Promise<string>)

export type Ask = { model: string; system?: string; prompt: string; effort?: string; maxTokens?: number; timeoutMs?: number }

export type World = {
  clock: MockClock
  files: Map<string, string>
  asks: Ask[]
  replies: Reply[]
  toasts: string[]
  commands: string[]
  messages: SessionMessage[]
}

export type WorldOptions = { env?: Record<string, string>; files?: Record<string, string>; messages?: SessionMessage[] }

export function world(on: On, { env = {}, files = {}, messages = [] }: WorldOptions = {}): World {
  const w: World = {
    clock: mock.clock(on, { now: T0 }),
    files: new Map(Object.entries(files)),
    asks: [],
    replies: [],
    toasts: [],
    commands: [],
    messages,
  }
  mock.env(on, env)

  on('model.complete', async (_$, e) => {
    w.asks.push({ model: e.model, system: e.system, prompt: e.prompt, effort: e.effort, maxTokens: e.maxTokens, timeoutMs: e.timeoutMs })
    const reply = w.replies.shift() ?? 'Fix auth refresh'

    if (typeof reply === 'object') {
      return { value: { isAnswered: false, reason: reply.reason, usage: USAGE } }
    }

    const text = typeof reply === 'function' ? await reply() : reply

    return { value: { isAnswered: true, text, usage: USAGE } }
  })
  on('fs.read', (_$, e) => {
    const text = w.files.get(e.path)

    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', (_$, e) => {
    w.files.set(e.path, e.text)

    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    w.toasts.push(e.text)

    return { value: undefined }
  })
  on('session.messages', () => ({ value: w.messages }))
  on('command.register', (_$, e) => {
    w.commands.push(e.name)

    return { value: { command: e.name } }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('classic.UserPromptSubmit', () => ({}))
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{`${e.component} ${ENGINE_TEXT}`}</Text>
  })

  return w
}

export async function submit(
  $: Engine,
  w: World,
  prompt: string,
  extra: { source?: 'user' | 'sdk' | 'system'; agent_id?: string; transcript_path?: string; session_title?: string } = {},
) {
  const result = await $.classic.UserPromptSubmit({ prompt, transcript_path: TRANSCRIPT, ...extra })
  await w.clock.advance(0)

  return result
}

export function startSession($: Engine, extra: { session_title?: string; transcript_path?: string; source?: 'resume' | 'clear' } = {}) {
  return $.classic.SessionStart({ source: 'resume', transcript_path: TRANSCRIPT, ...extra })
}

export function sidecar(title: string): string {
  return `${JSON.stringify({ title, model: 'anthropic/haiku', generatedAt: '2026-10-18T03:00:00.000Z' })}\n`
}

type Shown = { text: string; color?: string }

function leaves(node: unknown, color?: string): Shown[] {
  if (typeof node === 'string') {
    return [{ text: node, color }]
  }

  const element = node as { props?: { color?: string }; children?: readonly unknown[] }

  return (element.children ?? []).flatMap(child => leaves(child, element.props?.color ?? color))
}

export function shownText(node: unknown): string {
  return leaves(node)
    .map(leaf => leaf.text)
    .join('')
}
