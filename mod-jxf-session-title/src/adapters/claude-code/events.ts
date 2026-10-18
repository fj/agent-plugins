import { atom, read, update } from 'claude-code'
import type { EngineInterface, On } from 'claude-code'

import type { TitleConfig } from '../../config/config.ts'
import { modelLabel, resolveModelSpec } from '../../core/model.ts'
import { sidecarStore, type Files } from '../../core/sidecar.ts'
import { COMMAND, COMMAND_DESCRIPTION, titler, WARNING_PREFIX, type ModelChoice, type TitleHarness, type Titler } from '../../core/titler.ts'
import { currentProvider, type ProviderFlags } from './provider.ts'
import type { SessionTitleBand } from './state'

const bandAtom = atom({ plugin: 'mod-jxf-session-title', key: 'band' } as const, { kind: 'idle' })
const transcriptAtom = atom({ plugin: 'mod-jxf-session-title', key: 'transcript' } as const, null)
const unappliedTitleAtom = atom({ plugin: 'mod-jxf-session-title', key: 'unappliedTitle' } as const, null)
const nativeTitleAtom = atom({ plugin: 'mod-jxf-session-title', key: 'nativeTitle' } as const, null)

const TITLE_EFFORT = 'low'
const COMMAND_PREFIX = '/'
const USER_SOURCE = 'user'
const NO_TITLE_TEXT = 'The session has no title.'

const isUserPrompt = (prompt: string, source: string | undefined) =>
  (source === undefined || source === USER_SOURCE) && !prompt.trimStart().startsWith(COMMAND_PREFIX)

function engineFiles($: EngineInterface): Files {
  return {
    read: path => $.fs.read(path),
    write: (path, text) => $.fs.write(path, text),
  }
}

async function isCurrent($: EngineInterface, transcript: string): Promise<boolean> {
  return (await read($, transcriptAtom)) === transcript
}

async function showBand($: EngineInterface, transcript: string, band: SessionTitleBand): Promise<void> {
  if (await isCurrent($, transcript)) {
    await update($, bandAtom, () => band)
    $.ui.invalidate('ui.render')
  }
}

async function providerFlags($: EngineInterface): Promise<ProviderFlags> {
  return {
    CLAUDE_CODE_USE_BEDROCK: await $.env.get('CLAUDE_CODE_USE_BEDROCK'),
    CLAUDE_CODE_USE_VERTEX: await $.env.get('CLAUDE_CODE_USE_VERTEX'),
    CLAUDE_CODE_USE_FOUNDRY: await $.env.get('CLAUDE_CODE_USE_FOUNDRY'),
  }
}

async function chooseModel($: EngineInterface, spec: string): Promise<ModelChoice> {
  const provider = currentProvider(await providerFlags($))
  const model = resolveModelSpec(spec, provider)

  if (model === undefined || model.provider !== provider) {
    return { isAvailable: false, reason: `model ${model === undefined ? spec : modelLabel(model)} is not available on ${provider}` }
  }

  return { isAvailable: true, model }
}

async function takeUnappliedTitle($: EngineInterface): Promise<string | undefined> {
  const title = await read($, unappliedTitleAtom)
  await update($, unappliedTitleAtom, () => null)

  return title ?? undefined
}

function claudeHarness($: EngineInterface, config: TitleConfig, transcript: string): TitleHarness {
  return {
    session: transcript,
    store: sidecarStore(engineFiles($), transcript),
    now: () => $.clock.now(),
    model: () => chooseModel($, config.model),
    async complete(model, request) {
      const reply = await $.model.complete({
        model: model.id,
        system: request.system,
        prompt: request.prompt,
        maxTokens: request.maxTokens,
        effort: TITLE_EFFORT,
        timeoutMs: config.timeoutMs,
      })

      if (!reply.isAnswered) {
        throw new Error(`title request ${reply.reason}`)
      }

      return reply.text
    },
    async prompts() {
      const messages = await $.session.messages()

      return messages.filter(message => message.role === 'user' && message.text.trim() !== '').map(message => message.text)
    },
    nativeTitle: async () => ((await isCurrent($, transcript)) ? ((await read($, nativeTitleAtom)) ?? undefined) : undefined),
    async applyTitle(title) {
      if (await isCurrent($, transcript)) {
        await update($, nativeTitleAtom, () => title)
        await update($, unappliedTitleAtom, () => title)
      }
    },
    showAsking: (modelLabel, startedAt) => showBand($, transcript, { kind: 'asking', modelLabel, startedAt }),
    showTitle: title => showBand($, transcript, title === undefined ? { kind: 'idle' } : { kind: 'titled', title }),
    async warn(message) {
      if (await isCurrent($, transcript)) {
        $.ui.toast(`${WARNING_PREFIX}${message}`)
      }
    },
  }
}

async function enterTranscript($: EngineInterface, transcript: string, nativeTitle: string | undefined): Promise<void> {
  if ((await read($, transcriptAtom)) !== transcript) {
    await update($, transcriptAtom, () => transcript)
    await update($, unappliedTitleAtom, () => null)
    await update($, bandAtom, () => ({ kind: 'idle' }))
  }

  await update($, nativeTitleAtom, () => nativeTitle ?? null)
}

async function restoreTitle($: EngineInterface, config: TitleConfig, titles: Titler, transcript: string, nativeTitle: string | undefined): Promise<string | undefined> {
  await enterTranscript($, transcript, nativeTitle)
  await titles.restore(claudeHarness($, config, transcript))

  return takeUnappliedTitle($)
}

async function noteUserPrompt(
  $: EngineInterface,
  config: TitleConfig,
  titles: Titler,
  transcript: string,
  nativeTitle: string | undefined,
  prompt: string,
  source: string | undefined,
): Promise<string | undefined> {
  await enterTranscript($, transcript, nativeTitle)

  if (isUserPrompt(prompt, source)) {
    void titles.titleFirstPrompt(claudeHarness($, config, transcript), prompt).catch(() => undefined)
  }

  return takeUnappliedTitle($)
}

async function regenerateTitle($: EngineInterface, config: TitleConfig, titles: Titler): Promise<string | undefined> {
  const transcript = await read($, transcriptAtom)

  if (transcript === null) {
    return undefined
  }

  const harness = claudeHarness($, config, transcript)
  await titles.regenerate(harness)

  return titles.savedTitle(harness)
}

export function trackTitles(on: On, config: TitleConfig): void {
  const titles = titler(() => config)

  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await $.command.register({ name: COMMAND, description: COMMAND_DESCRIPTION })

    return started
  })

  on('classic.SessionStart', async ($, e, next) => {
    const result = await next(e)
    const title = await restoreTitle($, config, titles, e.transcript_path, e.session_title).catch(() => undefined)

    return title === undefined ? result : { ...result, sessionTitle: title }
  })

  on('classic.UserPromptSubmit', async ($, e, next) => {
    const result = await next(e)

    if (e.agent_id !== undefined) {
      return result
    }

    const title = await noteUserPrompt($, config, titles, e.transcript_path, e.session_title, e.prompt, e.source).catch(() => undefined)

    return title === undefined ? result : { ...result, sessionTitle: title }
  })

  on('command.run', { command: COMMAND }, async $ => {
    const title = await regenerateTitle($, config, titles).catch(() => undefined)

    return { text: title === undefined ? NO_TITLE_TEXT : `Session title: ${title}` }
  })
}
