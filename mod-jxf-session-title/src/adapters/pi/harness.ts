import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

import type { TitleConfig } from '../../config/config.ts'
import { modelLabel, resolveModelSpec } from '../../core/model.ts'
import { sidecarStore, type Files } from '../../core/sidecar.ts'
import { WARNING_PREFIX, type ModelChoice, type TitleHarness } from '../../core/titler.ts'
import { progressWidget, titleWidget, type Truncate } from './widget.ts'

export const WIDGET_KEY = 'mod-jxf-session-title'

export type PiHarnessEnv = {
  config: TitleConfig
  files: Files
  truncate: Truncate
  now: () => number
  newId: () => string
  isActive: () => boolean
}

type Block = { type: string; text?: string }
type Entry = { type: string; message?: { role?: string; content?: string | readonly Block[] } }

function textOf(content: string | readonly Block[] | undefined): string {
  if (typeof content === 'string') {
    return content
  }

  return (content ?? []).flatMap(block => (block.type === 'text' && block.text !== undefined ? [block.text] : [])).join('\n')
}

function userPrompts(entries: readonly Entry[]): string[] {
  return entries
    .filter(entry => entry.type === 'message' && entry.message?.role === 'user')
    .map(entry => textOf(entry.message?.content))
    .filter(text => text.trim() !== '')
}

function chooseModel(ctx: ExtensionContext, spec: string): ModelChoice {
  const model = resolveModelSpec(spec, ctx.model?.provider)
  const found = model && ctx.modelRegistry.find(model.provider, model.id)

  if (model === undefined || found === undefined || !ctx.modelRegistry.hasConfiguredAuth(found)) {
    return { isAvailable: false, reason: `model ${model === undefined ? spec : modelLabel(model)} is not available` }
  }

  return { isAvailable: true, model }
}

export function piHarness(pi: ExtensionAPI, ctx: ExtensionContext, env: PiHarnessEnv): TitleHarness {
  const { config, files, truncate, now, newId, isActive } = env
  const sessionFile = ctx.sessionManager.getSessionFile()
  const hasUI = () => isActive() && ctx.hasUI

  return {
    session: ctx.sessionManager.getSessionId(),
    store: sessionFile === undefined ? undefined : sidecarStore(files, sessionFile),
    now: async () => now(),
    model: async () => chooseModel(ctx, config.model),
    async complete(model, request) {
      const found = ctx.modelRegistry.find(model.provider, model.id)!
      const reply = await ctx.modelRegistry.complete(
        found,
        {
          systemPrompt: request.system,
          messages: [{ role: 'user', content: [{ type: 'text', text: request.prompt }], timestamp: now() }],
        },
        { cacheRetention: 'none', sessionId: newId(), maxTokens: request.maxTokens, signal: AbortSignal.timeout(config.timeoutMs) },
      )

      if (reply.stopReason === 'error' || reply.stopReason === 'aborted') {
        throw new Error(reply.errorMessage ?? `title request ${reply.stopReason}`)
      }

      return textOf(reply.content as readonly Block[])
    },
    prompts: async () => userPrompts(ctx.sessionManager.getBranch() as readonly Entry[]),
    nativeTitle: async () => (isActive() ? pi.getSessionName() : undefined),
    async applyTitle(title) {
      if (isActive()) {
        pi.setSessionName(title)
      }
    },
    async showAsking(modelLabel, startedAt) {
      if (hasUI()) {
        ctx.ui.setWidget(WIDGET_KEY, (tui, theme) => progressWidget(tui, theme, truncate, { modelLabel, startedAt, now }))
      }
    },
    async showTitle(title) {
      if (hasUI()) {
        ctx.ui.setWidget(WIDGET_KEY, title === undefined ? undefined : (_tui, theme) => titleWidget(title, theme, truncate))
      }
    },
    async warn(message) {
      if (hasUI()) {
        ctx.ui.notify(`${WARNING_PREFIX}${message}`, 'warning')
      }
    },
  }
}
