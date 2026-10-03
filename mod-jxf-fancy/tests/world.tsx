import type { On, SessionRateLimit, TurnStepChunk, TurnUsage } from 'claude-code'
import { mock, type Engine, type MockClock } from 'claude-code/testing'

export const PLUGIN = 'mod-jxf-fancy'
export const HOME = '/home/tester'
export const CWD = `${HOME}/src/projects/fancy`
export const SESSION_ID = 'session-1'
export const MODEL = 'claude-opus-5-5'
export const T0 = new Date(2026, 9, 3, 4, 20, 37).getTime()
export const dayDirOf = (day: string) => `${HOME}/.local/state/mod-jxf-fancy/days/${day}`
export const TODAY_DIR = dayDirOf('2026-10-03')
export const LIVE_SURFACES = ['terminal', 'desktop'] as const
export const ENGINE_TEXT = 'drawn by the engine'

export type Script = { chunks: TurnStepChunk[]; usage: TurnUsage | null }

export type World = {
  clock: MockClock
  files: Map<string, string>
  logs: string[]
  scripts: Script[]
  toolIds: string[]
  rateLimits: SessionRateLimit[]
}

export const USAGE: TurnUsage = {
  input_tokens: 1200,
  output_tokens: 300,
  cache_read_input_tokens: 5000,
  cache_creation_input_tokens: 0,
  model: MODEL,
}

export const TOOL_MS = 2000

const NO_ROW_STORE = 'no implementation for session.append'

export type WorldOptions = {
  files?: Record<string, string>
  turns?: number
  isToolFailing?: boolean
  isWriteFailing?: boolean
}

export function world(on: On, { files = {}, turns = 0, isToolFailing = false, isWriteFailing = false }: WorldOptions = {}): World {
  const w: World = {
    clock: mock.clock(on, { now: T0 }),
    files: new Map(Object.entries(files)),
    logs: [],
    scripts: [],
    toolIds: [],
    rateLimits: [],
  }
  mock.env(on, { HOME })

  on('session.id', () => ({ value: SESSION_ID }))
  on('session.model', () => ({ value: MODEL }))
  on('session.cwd', () => ({ value: CWD }))
  on('session.turns', () => ({ value: turns }))
  on('session.usage', () => ({ value: { startedAt: T0, context: { window: 200_000 }, rateLimits: w.rateLimits } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('ui.log', (_$, e) => {
    w.logs.push(e.text)

    return { value: undefined }
  })
  on('fs.write', (_$, e) => {
    if (isWriteFailing) {
      return { deny: `EACCES: ${e.path}` }
    }

    w.files.set(e.path, e.text)

    return { value: undefined }
  })
  on('fs.read', (_$, e) => {
    const text = w.files.get(e.path)

    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.list', (_$, e) => {
    const inside = [...w.files.keys()].filter(path => path.startsWith(`${e.path}/`))

    if (inside.length === 0) {
      return { deny: `ENOENT: ${e.path}` }
    }

    return {
      value: inside.map(path => ({
        name: path.slice(e.path.length + 1),
        kind: 'file' as const,
        size: 0,
        mtimeMs: 0,
        isLink: false,
      })),
    }
  })
  on('turn.step', async function* (_$, e) {
    const script = w.scripts.shift() ?? { chunks: [], usage: null }

    for (const chunk of script.chunks) {
      yield chunk
    }

    const answer = script.chunks.map(chunk => (chunk.kind === 'text' ? chunk.text : '')).join('')

    return {
      turnId: e.turnId,
      index: e.index,
      answer,
      toolUses: [],
      stopReason: 'end_turn' as const,
      usage: script.usage,
    }
  })
  on('tool.call', async (_$, e) => {
    w.toolIds.push(e.tool_use_id)
    await w.clock.sleep(TOOL_MS)

    if (isToolFailing) {
      throw new Error('the tool failed')
    }

    return { result: { stdout: '', stderr: '', interrupted: false }, text: 'ok' }
  })
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>{`${e.component} ${ENGINE_TEXT}`}</Text>
  })

  return w
}

export async function submit($: Engine, text: string): Promise<void> {
  await $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
}

async function keep(append: Promise<unknown>): Promise<void> {
  await append.catch((error: unknown) => {
    if (!String(error).includes(NO_ROW_STORE)) {
      throw error
    }
  })
}

export async function appendPrompt($: Engine, uuid: string, text: string): Promise<void> {
  await keep(
    $.session.append({
      uuid,
      door: 'prompt',
      origin: { kind: 'composer' },
      message: { type: 'user', role: 'user', content: [{ type: 'text', text }] },
    }),
  )
}

export async function appendReply($: Engine, uuid: string, text: string): Promise<void> {
  await keep(
    $.session.append({
      uuid,
      door: 'response',
      origin: { kind: 'model', model: MODEL },
      message: { type: 'assistant', role: 'assistant', content: [{ type: 'text', text }] },
    }),
  )
}

export function textReply(text: string, usage: TurnUsage | null = USAGE): Script {
  return { chunks: [{ kind: 'text', index: 0, text }], usage }
}

export function toolReply(id: string, usage: TurnUsage | null = USAGE): Script {
  return { chunks: [{ kind: 'tool', index: 0, id, name: 'Bash' }], usage }
}

export async function step($: Engine, turnId: string, index: number): Promise<void> {
  for await (const _chunk of $.turn.step({ turnId, index, model: MODEL, messageCount: 1 })) {
    void _chunk
  }
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

export function shownColors(node: unknown): string[] {
  return leaves(node).flatMap(leaf => (leaf.color === undefined ? [] : [leaf.color]))
}

export async function runTool($: Engine, w: World): Promise<void> {
  const call = $.tool.call({ tool: 'Bash', command: 'ls' })
  await w.clock.advance(TOOL_MS)
  await call
}
