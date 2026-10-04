import type { ContextUsage, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

import type { DailyStore } from '../src/core/daily.ts'
import type { Totals } from '../src/core/totals.ts'
import type { TextWidth } from '../pi/paint.ts'

type Handler = (event: unknown, ctx: ExtensionContext) => unknown
type Component = { render(width: number): string[] }
type Factory = (tui: unknown, theme: unknown, data?: unknown) => Component

export type FakeEntry = { type: string; customType?: string; data?: unknown; message?: unknown }

const ANSI = /\x1b\[[0-9;]*m/g

export const plain = (text: string) => text.replace(ANSI, '')

export const measure: TextWidth = {
  visibleWidth: text => [...plain(text)].length,
  truncateToWidth: (text, maxWidth) => {
    const chars = [...plain(text)]

    return chars.length <= maxWidth ? text : chars.slice(0, maxWidth).join('')
  },
}

export function fakePi() {
  const handlers = new Map<string, Handler[]>()
  const renderers = new Map<string, (entry: { data?: unknown }) => Component | undefined>()
  const branch: FakeEntry[] = []
  const api = {
    on(name: string, handler: Handler) {
      handlers.set(name, [...(handlers.get(name) ?? []), handler])
    },
    appendEntry(customType: string, data: unknown) {
      branch.push({ type: 'custom', customType, data })
    },
    registerEntryRenderer(customType: string, renderer: (entry: { data?: unknown }) => Component | undefined) {
      renderers.set(customType, renderer)
    },
  }

  return {
    api: api as unknown as ExtensionAPI,
    branch,
    handlerNames: () => [...handlers.keys()],
    emit: async (name: string, event: object, ctx: ExtensionContext) => {
      for (const handler of handlers.get(name) ?? []) {
        await handler({ type: name, ...event }, ctx)
      }
    },
    render: (entry: FakeEntry, width: number) => renderers.get(entry.customType ?? '')?.({ data: entry.data })?.render(width),
    renders: (entry: FakeEntry) => renderers.get(entry.customType ?? '')?.({ data: entry.data }) !== undefined,
  }
}

export function fakeCtx(branch: FakeEntry[], options: { mode?: string; provider?: string; oauth?: boolean; context?: ContextUsage } = {}) {
  const widgets = new Map<string, Factory | undefined>()
  let footer: Factory | undefined
  let context = options.context
  const ui = {
    setFooter: (factory: Factory | undefined) => {
      footer = factory
    },
    setWidget: (key: string, factory: Factory | undefined) => {
      widgets.set(key, factory)
    },
  }
  const ctx = {
    mode: options.mode ?? 'tui',
    cwd: '/home/j/src/projects/demo',
    model: { id: 'claude-opus-5-5', provider: options.provider ?? 'anthropic' },
    modelRegistry: { isUsingOAuth: () => options.oauth ?? true },
    getContextUsage: () => context,
    sessionManager: { getSessionId: () => 'sess-1', getBranch: () => branch, getEntries: () => branch },
    ui,
  }

  const setContext = (usage: ContextUsage | undefined) => {
    context = usage
  }

  return { ctx: ctx as unknown as ExtensionContext, widgets, footer: () => footer, setContext }
}

export function memoryStore(others: Totals[] = []) {
  const writes: { day: string; key: string; totals: Totals }[] = []
  const store: DailyStore = {
    write: async (day, key, totals) => {
      writes.push({ day, key, totals })
    },
    readAll: async () => others,
  }

  return { store, writes }
}

export function fakeTui() {
  let renders = 0

  return { requestRender: () => void (renders += 1), renders: () => renders }
}

export const footerData = (statuses: Record<string, string> = {}, branch: string | null = 'main') => ({
  getGitBranch: () => branch,
  getExtensionStatuses: () => new Map(Object.entries(statuses)),
})
