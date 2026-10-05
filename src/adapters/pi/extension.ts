import type { ContextUsage, ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

import { footerLayout, subscriptionName, type FancyConfig, type ModelInfo } from '../../config/config.ts'
import type { DailyStore } from '../../core/daily.ts'
import { isJournalRecord, type JournalRecord } from '../../core/journal.ts'
import type { QuotaWindow } from '../../core/quota.ts'
import { sessionTracker, type SessionTracker } from '../../core/tracker.ts'
import type { TokenUsage } from '../../core/usage.ts'
import type { ContextFill } from '../../render/context.ts'
import { subscriptionStrategy, type SubscriptionStrategy } from '../../strategies/subscription/index.ts'
import { usageStrategy, type UsageStrategy } from '../../strategies/usage/index.ts'
import { readConfig } from './config.ts'
import { footerLines, type FooterData, type FooterScene } from './footer.ts'
import type { TextWidth } from './paint.ts'
import { ticker } from './ticker.ts'
import { patchToolRows, type ToolRowPrototype } from './tool-rows.ts'
import { promptLines, stepLines, toolTimerLine, view } from './views.ts'

export const CUSTOM_TYPE = 'mod-jxf-fancy-details'
export const FRAME_MS = 100
export const PERSIST_POLL_MS = 5
export const MAX_PERSIST_POLLS = 40

const SESSION_KEY_PREFIX = 'pi-'
const TODAY_REFRESH_MS = 30_000

export type FancyDeps = {
  measure: TextWidth
  store: DailyStore
  home: string
  configPath: string
  toolRows?: ToolRowPrototype
  readConfig?: (path: string) => FancyConfig
  now?: () => number
  newId?: () => string
}

type Entry = { type: string; customType?: string; data?: unknown; message?: unknown }
type Renderable = { requestRender(): void }
type Message = { role: string; timestamp?: number; model?: string; usage?: TokenUsage }

const NESTED_CALL_SEPARATOR = '/'

const isNestedCall = (event: { toolCallId: string; parentToolCallId?: string }) =>
  event.parentToolCallId !== undefined || event.toolCallId.includes(NESTED_CALL_SEPARATOR)

const journalRecords = (entries: readonly Entry[]): JournalRecord[] =>
  entries.flatMap(entry => (entry.type === 'custom' && entry.customType === CUSTOM_TYPE && isJournalRecord(entry.data) ? [entry.data] : []))

const contextFill = (usage: ContextUsage | undefined): ContextFill | undefined =>
  usage === undefined ? undefined : { tokens: usage.tokens ?? undefined, window: usage.contextWindow }

const tokenUsage = (usage: TokenUsage | undefined): TokenUsage => ({
  input: usage?.input ?? 0,
  cacheRead: usage?.cacheRead ?? 0,
  cacheWrite: usage?.cacheWrite ?? 0,
  output: usage?.output ?? 0,
})

export function modJxfFancyDetails(deps: FancyDeps): (pi: ExtensionAPI) => void {
  const now = deps.now ?? Date.now
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const loadConfig = deps.readConfig ?? readConfig

  return pi => {
    let ctx: ExtensionContext | undefined
    let config: FancyConfig = {}
    let usage: UsageStrategy = usageStrategy(undefined)
    let subscription: SubscriptionStrategy = subscriptionStrategy(undefined)
    let windows: readonly QuotaWindow[] | null = null
    let model: ModelInfo | undefined
    let tui: Renderable | undefined
    let running = false
    let pendingPrompt: { record: JournalRecord; message: unknown; polls: number } | undefined
    let unpatchToolRows: (() => void) | undefined
    let openStepId: string | undefined
    let tracker: SessionTracker = sessionTracker({ store: deps.store, sessionKey: SESSION_KEY_PREFIX, price: usage.price })

    const scene: FooterScene = {
      ledger: () => tracker.ledger(),
      now,
      usage: () => usage,
      measure: deps.measure,
      model: () => model?.id ?? 'no model',
      cwd: () => ctx?.cwd ?? '',
      home: deps.home,
      today: () => tracker.today(now()),
      quota: () => (windows === null ? [] : subscription.render(windows)),
      context: () => contextFill(ctx?.getContextUsage()),
      layout: () => footerLayout(config),
    }

    const frames = ticker(FRAME_MS, () => {
      tui?.requestRender()

      if (!running) {
        frames.stop()
      }
    })

    const refresher = ticker(TODAY_REFRESH_MS, () => void refreshOthers())

    async function refreshOthers() {
      await tracker.refreshOthers(now())
      tui?.requestRender()
    }

    function chooseStrategies() {
      usage = usageStrategy(config.usageStrategy)
      subscription = subscriptionStrategy(
        subscriptionName(config, model, m => ctx?.modelRegistry.isUsingOAuth(m as never) ?? false),
      )
    }

    function append(record: JournalRecord) {
      flushPrompt()
      pi.appendEntry(CUSTOM_TYPE, record)
    }

    function record(entry: JournalRecord) {
      tracker.record(entry)
      append(entry)
    }

    function flushPrompt() {
      const pending = pendingPrompt

      pendingPrompt = undefined

      if (pending !== undefined) {
        pi.appendEntry(CUSTOM_TYPE, pending.record)
      }
    }

    function isPersisted(message: unknown): boolean {
      return (ctx?.sessionManager.getBranch() ?? []).some(entry => entry.type === 'message' && entry.message === message)
    }

    function awaitPromptPersisted() {
      const pending = pendingPrompt

      if (pending === undefined) {
        return
      }

      if (isPersisted(pending.message) || pending.polls >= MAX_PERSIST_POLLS) {
        flushPrompt()

        return
      }

      pending.polls += 1
      setTimeout(awaitPromptPersisted, PERSIST_POLL_MS)
    }

    function replay(context: ExtensionContext) {
      tracker.replay(
        journalRecords(context.sessionManager.getBranch() as Entry[]),
        journalRecords(context.sessionManager.getEntries() as Entry[]),
      )
    }

    function showUi(context: ExtensionContext) {
      context.ui.setFooter((host, _theme, data: FooterData) => {
        tui = host

        return view(width => footerLines(scene, data, width))
      })

      if (deps.toolRows !== undefined && unpatchToolRows === undefined) {
        unpatchToolRows = patchToolRows(deps.toolRows, (id, width) => toolTimerLine(scene, id, width))
      }

      refresher.start()
    }

    function shutdown() {
      flushPrompt()
      frames.stop()
      refresher.stop()
      unpatchToolRows?.()
      unpatchToolRows = undefined
      running = false
      tui = undefined
    }

    pi.registerEntryRenderer<JournalRecord>(CUSTOM_TYPE, entry => {
      const data = entry.data

      if (data?.kind === 'prompt') {
        return view(width => promptLines(scene, data.id, width))
      }

      return data?.kind === 'step' ? view(width => stepLines(scene, data.id, width)) : undefined
    })

    pi.on('session_start', async (_event, context) => {
      ctx = context
      config = loadConfig(deps.configPath)
      model = context.model
      chooseStrategies()
      tracker = sessionTracker({
        store: deps.store,
        sessionKey: `${SESSION_KEY_PREFIX}${context.sessionManager.getSessionId()}`,
        price: usage.price,
      })
      replay(context)

      if (context.mode === 'tui') {
        showUi(context)
        await refreshOthers()
      }
    })

    pi.on('session_tree', async (_event, context) => {
      replay(context)
      tui?.requestRender()
    })

    pi.on('model_select', async (event, context) => {
      ctx = context
      model = event.model
      windows = null
      chooseStrategies()
    })

    pi.on('agent_start', async () => {
      running = true
      frames.start()
    })

    pi.on('message_start', async event => {
      const message = event.message as Message

      if (message.role === 'assistant') {
        openStepId = newId()
        const at = now()

        record({ kind: 'step', id: openStepId, at, model: message.model ?? '' })
        record({ kind: 'message', id: openStepId, at })
      }
    })

    pi.on('message_end', async event => {
      const message = event.message as Message

      if (message.role === 'user') {
        flushPrompt()
        const prompt: JournalRecord = { kind: 'prompt', id: newId(), at: message.timestamp ?? now() }

        tracker.record(prompt)
        pendingPrompt = { record: prompt, message: event.message, polls: 0 }
        setTimeout(awaitPromptPersisted, 0)
      }

      if (message.role === 'assistant' && openStepId !== undefined) {
        record({ kind: 'stepEnd', id: openStepId, at: now(), usage: tokenUsage(message.usage) })
        openStepId = undefined
      }
    })

    pi.on('tool_execution_start', async event => {
      if (!isNestedCall(event)) {
        record({ kind: 'tool', id: event.toolCallId, at: now() })
      }
    })

    pi.on('tool_execution_end', async event => {
      if (!isNestedCall(event)) {
        record({ kind: 'toolEnd', id: event.toolCallId, at: now() })
      }
    })

    pi.on('after_provider_response', async event => {
      windows = subscription.read({ headers: event.headers }) ?? windows
    })

    pi.on('agent_settled', async () => {
      running = false

      if (tracker.ledger().currentPromptId !== undefined) {
        record({ kind: 'turnEnd', at: now() })
      }

      tui?.requestRender()
      await refreshOthers()
    })

    pi.on('session_shutdown', async () => {
      shutdown()
    })
  }
}
