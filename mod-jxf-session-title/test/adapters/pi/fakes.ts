import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

import type { Files } from '../../../src/core/sidecar.ts'

type Handler = (event: object, ctx: ExtensionContext) => unknown
type Command = { handler: (args: string, ctx: ExtensionContext) => Promise<void> }
type Component = { render(width: number): string[]; dispose?(): void }
type Factory = (tui: { requestRender(): void }, theme: { fg(color: string, text: string): string }) => Component

export const SESSION_FILE = '/sessions/2026_abc.jsonl'
export const SIDECAR_FILE = '/sessions/2026_abc.session-title.json'
export const STALE = 'this extension instance is stale after runtime replacement'

export const plainTheme = { fg: (_color: string, text: string) => text }

export const truncate = (text: string, maxWidth: number) => [...text].slice(0, maxWidth).join('')

export function memoryFiles(initial: Record<string, string> = {}): Files & { all: Map<string, string> } {
  const all = new Map(Object.entries(initial))

  return {
    all,
    read: async path => all.get(path) ?? Promise.reject(new Error(`ENOENT: ${path}`)),
    write: async (path, text) => void all.set(path, text),
  }
}

const SETTLE_ROUNDS = 20

export async function settle(): Promise<void> {
  for (let round = 0; round < SETTLE_ROUNDS; round++) {
    await new Promise(resolve => setImmediate(resolve))
  }
}

function staleGuard(isStale: () => boolean) {
  return <T extends (...args: never[]) => unknown>(fn: T): T =>
    ((...args: never[]) => {
      if (isStale()) {
        throw new Error(STALE)
      }

      return fn(...args)
    }) as T
}

export type SessionNames = { name: string | undefined }

export function fakePi(names: SessionNames = { name: undefined }) {
  const handlers = new Map<string, Handler[]>()
  const commands = new Map<string, Command>()
  let isStale = false
  let lastCtx: ExtensionContext | undefined
  const live = staleGuard(() => isStale)

  const emit = async (event: string, payload: object, ctx: ExtensionContext) => {
    for (const handler of handlers.get(event) ?? []) {
      await handler({ type: event, ...payload }, ctx)
    }
  }

  const api = {
    on: live((event: string, handler: Handler) => void handlers.set(event, [...(handlers.get(event) ?? []), handler])),
    registerCommand: live((command: string, options: Command) => void commands.set(command, options)),
    getSessionName: live(() => names.name),
    setSessionName: live((next: string) => {
      names.name = next

      if (lastCtx !== undefined) {
        void emit('session_info_changed', { name: next }, lastCtx)
      }
    }),
  }

  return {
    api: api as unknown as ExtensionAPI,
    name: () => names.name,
    async emit(event: string, payload: object, ctx: ExtensionContext) {
      lastCtx = ctx
      await emit(event, payload, ctx)
      await settle()
    },
    async command(command: string, ctx: ExtensionContext) {
      lastCtx = ctx
      await commands.get(command)?.handler('', ctx)
      await settle()
    },
    async shutdown(ctx: ExtensionContext, reason = 'new') {
      await emit('session_shutdown', { reason }, ctx)
      isStale = true
    },
  }
}

export type FakeReply = { text?: string; stopReason?: string; errorMessage?: string }

export type CtxOptions = {
  provider?: string
  models?: string[]
  reply?: FakeReply | (() => Promise<FakeReply>)
  hasUI?: boolean
  sessionFile?: string
  sessionId?: string
  branch?: object[]
}

type Call = { model: string; systemPrompt: string; prompt: string; options: { signal?: AbortSignal; [key: string]: unknown } }

function untilAborted(signal: AbortSignal | undefined): Promise<FakeReply> {
  return new Promise(resolve => signal?.addEventListener('abort', () => resolve({ stopReason: 'aborted' })))
}

export function fakeCtx(options: CtxOptions = {}) {
  const widgets: (Factory | undefined)[] = []
  const notices: string[] = []
  const calls: Call[] = []
  const models = new Set(options.models ?? ['claude-bridge/claude-haiku-5-5'])
  let isStale = false
  const live = staleGuard(() => isStale)
  const ctx = {
    get hasUI() {
      return live(() => options.hasUI ?? true)()
    },
    model: { provider: options.provider ?? 'claude-bridge', id: 'claude-opus-5-5' },
    modelRegistry: {
      find: live((provider: string, id: string) => (models.has(`${provider}/${id}`) ? { provider, id } : undefined)),
      hasConfiguredAuth: live(() => true),
      async complete(model: { provider: string; id: string }, context: { systemPrompt: string; messages: { content: { text: string }[] }[] }, callOptions: Call['options']) {
        calls.push({ model: `${model.provider}/${model.id}`, systemPrompt: context.systemPrompt, prompt: context.messages[0]!.content[0]!.text, options: callOptions })
        const answer = typeof options.reply === 'function' ? options.reply() : Promise.resolve(options.reply ?? { text: 'Fix auth refresh' })
        const reply = await Promise.race([answer, untilAborted(callOptions.signal)])

        return { stopReason: reply.stopReason ?? 'stop', errorMessage: reply.errorMessage, content: [{ type: 'text', text: reply.text ?? '' }] }
      },
    },
    sessionManager: {
      getSessionId: live(() => options.sessionId ?? 'sess-1'),
      getSessionFile: live(() => ('sessionFile' in options ? options.sessionFile : SESSION_FILE)),
      getBranch: live(() => options.branch ?? []),
    },
    ui: {
      setWidget: live((_key: string, factory: Factory | undefined) => void widgets.push(factory)),
      notify: live((text: string) => void notices.push(text)),
    },
  }

  return {
    ctx: ctx as unknown as ExtensionContext,
    calls,
    notices,
    invalidate: () => (isStale = true),
    widgetCount: () => widgets.length,
    shownLine(width = 120) {
      const factory = widgets.at(-1)
      const component = factory?.({ requestRender() {} }, plainTheme)
      const line = component?.render(width)[0]
      component?.dispose?.()

      return line
    },
  }
}
