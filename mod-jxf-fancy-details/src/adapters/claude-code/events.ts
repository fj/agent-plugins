import { atom, read, update } from 'claude-code'
import type { EngineInterface, On, SessionContextUsage, TurnUsage } from 'claude-code'

import type { ClaudeCodeCacheEnv } from '../../core/cache.ts'
import type { DailyStore } from '../../core/daily.ts'
import { readGit, SHOW_STATUS } from '../../core/git-status.ts'
import { latestRun, type LatestRun } from '../../core/latest.ts'
import { applyRecord, EMPTY_JOURNAL, type JournalRecord } from '../../core/journal.ts'
import { aliasRow, appendKeyText, EMPTY_ROWS, noteText, pendingMessageMark, pendingPrompt } from '../../core/rows.ts'
import { isPersistedRecord, NO_OTHER_SESSIONS, persistDay, readOtherSessions } from '../../core/tracker.ts'
import type { TokenUsage } from '../../core/usage.ts'
import { gitStatusText } from '../../render/git-status.ts'
import type { Config } from './config.ts'
import { fileDailyStore, sessionKeyFor, type Files } from './daily.ts'
import { isUserOrigin } from './origin.ts'
import { claudeCodeBilling, claudeCodeProvider, type CloudFlags } from './provider.ts'

const journalAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'journal' } as const, EMPTY_JOURNAL)
const othersAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'others' } as const, NO_OTHER_SESSIONS)
const rowsAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'rows' } as const, EMPTY_ROWS)
const rateLimitsAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'rateLimits' } as const, [])
const contextAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'context' } as const, null)
const branchAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'branch' } as const, null)
const gitStatusAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'gitStatus' } as const, null)
const routeAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'route' } as const, null)
const effortAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'effort' } as const, null)

const POLL_MS = 30_000
const GIT_TIMEOUT_MS = 2000

type ContentBlock = { type: string; [field: string]: unknown }

function toTokenUsage(usage: TurnUsage): TokenUsage {
  return {
    input: usage.input_tokens,
    cacheRead: usage.cache_read_input_tokens,
    cacheWrite: usage.cache_creation_input_tokens,
    output: usage.output_tokens,
  }
}

function blockText(content: readonly ContentBlock[]): string {
  return content
    .filter(block => block.type === 'text' && typeof block.text === 'string')
    .map(block => block.text as string)
    .join('')
}

async function dailyStore($: EngineInterface): Promise<DailyStore> {
  const home = (await $.env.get('HOME')) ?? ''
  const files: Files = {
    write: (path, text) => $.fs.write(path, text),
    list: path => $.fs.list(path),
    read: path => $.fs.read(path),
  }

  return fileDailyStore(files, home)
}

async function sessionKey($: EngineInterface): Promise<string> {
  return sessionKeyFor(await $.session.id())
}

async function record($: EngineInterface, config: Config, entry: JournalRecord): Promise<void> {
  const journal = await update($, journalAtom, all => applyRecord(all, entry, config.usage.price))

  if (isPersistedRecord(entry)) {
    await persistDay(await dailyStore($), await sessionKey($), journal.days, entry.at)
  }
}

async function refreshOthers($: EngineInterface): Promise<void> {
  const others = await readOtherSessions(await dailyStore($), await sessionKey($), await $.clock.now())
  await update($, othersAtom, () => others)
}

async function refreshGit($: EngineInterface, gitRuns: LatestRun): Promise<void> {
  const cwd = await $.session.cwd()
  const reading = $.process
    .run(SHOW_STATUS, { cwd, timeoutMs: GIT_TIMEOUT_MS })
    .then(readGit)
    .catch(() => undefined)

  await gitRuns(reading, async git => {
    await update($, branchAtom, branch => (git === undefined ? branch : git.branch))
    await update($, gitStatusAtom, () => (git === undefined || git.status === null ? null : gitStatusText(git.status)))
  })
}

async function cloudFlags($: EngineInterface): Promise<CloudFlags> {
  return {
    bedrock: await $.env.get('CLAUDE_CODE_USE_BEDROCK'),
    vertex: await $.env.get('CLAUDE_CODE_USE_VERTEX'),
    foundry: await $.env.get('CLAUDE_CODE_USE_FOUNDRY'),
    anthropicAws: await $.env.get('CLAUDE_CODE_USE_ANTHROPIC_AWS'),
    anthropicGoogleCloud: await $.env.get('CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD'),
    mantle: await $.env.get('CLAUDE_CODE_USE_MANTLE'),
    gateway: await $.env.get('CLAUDE_CODE_USE_GATEWAY'),
  }
}

async function cacheEnv($: EngineInterface): Promise<ClaudeCodeCacheEnv> {
  return {
    disable: await $.env.get('DISABLE_PROMPT_CACHING'),
    force5m: await $.env.get('FORCE_PROMPT_CACHING_5M'),
    ttl: await $.env.get('CLAUDE_CODE_PROMPT_CACHE_TTL'),
    enable1h: await $.env.get('ENABLE_PROMPT_CACHING_1H'),
    enable1hBedrock: await $.env.get('ENABLE_PROMPT_CACHING_1H_BEDROCK'),
  }
}

async function refreshRoute($: EngineInterface): Promise<void> {
  const provider = claudeCodeProvider(await cloudFlags($))
  const credential = await $.session.authorize().catch(() => null)
  const billing = claudeCodeBilling(provider, credential?.kind)
  const settings = await $.settings.read().catch(() => undefined)
  const setting = settings?.promptCacheTtl
  const cache = {
    env: await cacheEnv($),
    setting: typeof setting === 'string' ? setting : null,
    isBedrock: provider === 'bedrock',
    isSubscriber: billing === 'subscription',
  }

  await update($, routeAtom, () => ({ provider, billing, cache }))
}

async function refreshPolled($: EngineInterface, gitRuns: LatestRun): Promise<void> {
  await Promise.all([refreshOthers($), refreshGit($, gitRuns)])
}

function debugLog($: EngineInterface, isDebug: boolean, text: string): void {
  if (isDebug) {
    $.ui.log(text)
  }
}

const contextFill = ({ tokens, window }: SessionContextUsage) => ({ tokens, window })

async function refreshUsage($: EngineInterface): Promise<void> {
  const { rateLimits, context } = await $.session.usage()
  await update($, rateLimitsAtom, () => rateLimits)
  await update($, contextAtom, () => contextFill(context))
}

export function trackEvents(on: On, config: Config): void {
  const gitRuns = latestRun()

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await refreshRoute($)
    await refreshUsage($)
    await refreshPolled($, gitRuns)
    $.clock.every(POLL_MS, () => void refreshPolled($, gitRuns))

    return started
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      await update($, rateLimitsAtom, () => e.rateLimits)
    }

    if (e.changed.includes('context')) {
      await update($, contextAtom, () => contextFill(e.context))
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    if (!isUserOrigin(e.origin)) {
      return next(e)
    }

    const at = await $.clock.now()
    let id = ''
    await update($, journalAtom, journal => {
      id = `prompt-${journal.ledger.turn + 1}`

      return applyRecord(journal, { kind: 'prompt', id, at }, config.usage.price)
    })
    await update($, rowsAtom, rows => noteText(rows, id, e.text))

    return next(e)
  })

  on('session.append', async ($, e, next) => {
    const text = blockText(e.message.content)
    const isPrompt = e.door === 'prompt' && isUserOrigin(e.origin)
    const isReply = e.door === 'response' && text !== ''

    if (e.agentId === undefined && (isPrompt || isReply)) {
      const { ledger } = await read($, journalAtom)
      const rows = await read($, rowsAtom)
      const id = isPrompt ? pendingPrompt(ledger, rows, text) : pendingMessageMark(ledger, rows, text)

      if (id !== undefined) {
        await update($, rowsAtom, all => aliasRow(all, e.uuid, id))
      }

      debugLog($, config.isDebug, `${e.door} row ${e.uuid} -> ${id ?? 'no match'}`)
    }

    return next(e)
  })

  on('turn.step', async function* ($, e, next) {
    if (e.agentId !== undefined) {
      const result = yield* next(e)

      if (result.usage !== null) {
        await record($, config, { kind: 'agentStep', at: await $.clock.now(), model: e.model, usage: toTokenUsage(result.usage) })
      }

      return result
    }

    const stepId = `${e.turnId}:${e.index}`
    await update($, effortAtom, () => e.effort ?? null)
    await record($, config, { kind: 'step', id: stepId, at: await $.clock.now(), model: e.model })

    const texts = new Map<number, string>()
    const stream = next(e)
    let usage: TokenUsage | undefined

    try {
      for await (const chunk of stream) {
        if (chunk.kind === 'text' && chunk.text !== '') {
          const seen = texts.get(chunk.index)

          if (seen === undefined) {
            await record($, config, { kind: 'message', id: `${stepId}:${chunk.index}`, at: await $.clock.now() })
          }

          texts.set(chunk.index, appendKeyText(seen ?? '', chunk.text))
        }

        yield chunk
      }

      const result = await stream.result
      await update($, rowsAtom, rows =>
        [...texts].reduce((all, [index, text]) => noteText(all, `${stepId}:${index}`, text), rows),
      )
      usage = result.usage === null ? undefined : toTokenUsage(result.usage)

      return result
    } finally {
      await record($, config, { kind: 'stepEnd', id: stepId, at: await $.clock.now(), usage })
    }
  })

  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined) {
      return next(e)
    }

    const id = e.tool_use_id
    await record($, config, { kind: 'tool', id, at: await $.clock.now() })

    try {
      return await next(e)
    } finally {
      await record($, config, { kind: 'toolEnd', id, at: await $.clock.now() })
      await refreshGit($, gitRuns)
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      const { ledger } = await read($, journalAtom)

      if (ledger.currentPromptId !== undefined) {
        await record($, config, { kind: 'turnEnd', at: await $.clock.now() })
      }

      await refreshPolled($, gitRuns)
    }

    return next(e)
  })
}
