import type { ContextUsage, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

import type { DailyStore } from '../../../src/core/daily.ts'
import type { Totals } from '../../../src/core/totals.ts'
import type { TextWidth } from '../../../src/adapters/pi/paint.ts'

type Handler = (event: unknown, ctx: ExtensionContext) => unknown
type Component = { render(width: number): string[] }
type Factory = (tui: unknown, theme: unknown, data?: unknown) => Component

export type FakeEntry = { type: string; customType?: string; data?: unknown; message?: unknown }

type Exec = { command: string; args: string[]; cwd?: string }

const NOT_A_REPO = 128

const ANSI = /\x1b\[[0-9;]*m/g
const ANSI_TOKEN = /(\x1b\[[0-9;]*m)/
const RESET = '\x1b[0m'

export const plain = (text: string) => text.replace(ANSI, '')

export const measure: TextWidth = {
  visibleWidth: text => [...plain(text)].length,
  truncateToWidth: (text, maxWidth) => {
    const chars = [...plain(text)]

    return chars.length <= maxWidth ? text : chars.slice(0, maxWidth).join('')
  },
  wrapTextWithAnsi: (text, width) =>
    carryStyles(
      text
        .split(' ')
        .flatMap(word => splitWide(word, width))
        .reduce<string[]>((lines, word) => {
          const last = lines.at(-1)

          return last !== undefined && plain(last).length + 1 + plain(word).length <= width
            ? [...lines.slice(0, -1), `${last} ${word}`]
            : [...lines, word]
        }, []),
    ),
}

function splitWide(word: string, width: number): string[] {
  const pieces = ['']
  let pieceWidth = 0

  for (const token of word.split(ANSI_TOKEN).flatMap(part => (ANSI_TOKEN.test(part) ? [part] : [...part]))) {
    if (!ANSI_TOKEN.test(token) && pieceWidth === width) {
      pieces.push('')
      pieceWidth = 0
    }

    pieces[pieces.length - 1] += token
    pieceWidth += ANSI_TOKEN.test(token) ? 0 : 1
  }

  return pieces
}

function carryStyles(lines: readonly string[]): string[] {
  let active = ''

  return lines.map(line => {
    const carried = `${active}${line}`

    for (const [code] of line.matchAll(ANSI)) {
      active = code === RESET ? '' : `${active}${code}`
    }

    return carried
  })
}

export function fakePi() {
  const handlers = new Map<string, Handler[]>()
  const renderers = new Map<string, (entry: { data?: unknown }) => Component | undefined>()
  const branch: FakeEntry[] = []
  const execs: Exec[] = []
  let thinkingLevel = 'off'
  let porcelain: string | null = ''
  const api = {
    getThinkingLevel: () => thinkingLevel,
    exec: async (command: string, args: string[], options?: { cwd?: string }) => {
      execs.push({ command, args, cwd: options?.cwd })

      return porcelain === null
        ? { stdout: '', stderr: 'fatal: not a git repository', code: NOT_A_REPO, killed: false }
        : { stdout: porcelain, stderr: '', code: 0, killed: false }
    },
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
    execs,
    setThinkingLevel: (level: string) => {
      thinkingLevel = level
    },
    setPorcelain: (text: string | null) => {
      porcelain = text
    },
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

export type CtxOptions = {
  mode?: string
  provider?: string
  reasoning?: boolean
  oauth?: boolean
  context?: ContextUsage
  promptCache?: { short?: number; long?: number }
}

export function fakeCtx(branch: FakeEntry[], options: CtxOptions = {}) {
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
    model: { id: 'claude-opus-5-5', provider: options.provider ?? 'anthropic', reasoning: options.reasoning, promptCache: options.promptCache },
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
