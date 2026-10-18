import { modelLabel, type TitleModel } from './model.ts'
import type { TitleStore } from './sidecar.ts'
import { cleanTitle, titleRequest, type TitleRequest, type TitleSettings } from './title.ts'

export const COMMAND = 'session-title'
export const COMMAND_DESCRIPTION = 'Ask a small model for a new session title'
export const WARNING_PREFIX = 'session-title: '

export type ModelChoice = { isAvailable: true; model: TitleModel } | { isAvailable: false; reason: string }

export interface TitleHarness {
  readonly session: string
  readonly store: TitleStore | undefined
  now(): Promise<number>
  model(): Promise<ModelChoice>
  complete(model: TitleModel, request: TitleRequest): Promise<string>
  prompts(): Promise<readonly string[]>
  nativeTitle(): Promise<string | undefined>
  applyTitle(title: string): Promise<void>
  showAsking(modelLabel: string, startedAt: number): Promise<void>
  showTitle(title: string | undefined): Promise<void>
  warn(message: string): Promise<void>
}

export type TitlerSettings = TitleSettings & { isAutomatic: boolean }

export type Titler = {
  savedTitle(harness: TitleHarness): Promise<string | undefined>
  restore(harness: TitleHarness): Promise<void>
  titleFirstPrompt(harness: TitleHarness, prompt: string): Promise<void>
  regenerate(harness: TitleHarness): Promise<void>
}

const EMPTY_REPLY = 'the model gave no title'
const NO_PROMPTS = 'there is no prompt to name the session from'

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error))

async function storedTitle(harness: TitleHarness): Promise<string | undefined> {
  return (await harness.store?.read())?.title
}

async function savedTitle(harness: TitleHarness): Promise<string | undefined> {
  return (await harness.nativeTitle()) ?? (await storedTitle(harness))
}

export function titler(currentSettings: () => TitlerSettings): Titler {
  const pending = new Set<string>()

  async function generate(harness: TitleHarness, prompts: readonly string[]): Promise<void> {
    if (pending.has(harness.session)) {
      return
    }

    pending.add(harness.session)
    const settings = currentSettings()

    try {
      const choice = await harness.model()

      if (!choice.isAvailable) {
        await harness.warn(choice.reason)
        return
      }

      if (prompts.length === 0) {
        await harness.warn(NO_PROMPTS)
        return
      }

      const label = modelLabel(choice.model)
      await harness.showAsking(label, await harness.now())
      const title = cleanTitle(await harness.complete(choice.model, titleRequest(prompts, settings)), settings.maxTitleChars)

      if (title === undefined) {
        throw new Error(EMPTY_REPLY)
      }

      await harness.store?.write({ title, model: label, generatedAt: new Date(await harness.now()).toISOString() })
      await harness.applyTitle(title)
    } catch (error) {
      await harness.warn(messageOf(error))
    } finally {
      pending.delete(harness.session)
      await harness.showTitle(await savedTitle(harness))
    }
  }

  return {
    savedTitle,
    async restore(harness) {
      const stored = (await harness.nativeTitle()) === undefined ? await storedTitle(harness) : undefined

      if (stored !== undefined) {
        await harness.applyTitle(stored)
      }

      await harness.showTitle(await savedTitle(harness))
    },
    async titleFirstPrompt(harness, prompt) {
      if (currentSettings().isAutomatic && !pending.has(harness.session) && (await savedTitle(harness)) === undefined) {
        await generate(harness, [prompt])
      }
    },
    regenerate: async harness => generate(harness, await harness.prompts()),
  }
}
