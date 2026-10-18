import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

import type { TitleConfig } from '../../config/config.ts'
import type { Files } from '../../core/sidecar.ts'
import { COMMAND, COMMAND_DESCRIPTION, titler } from '../../core/titler.ts'
import { readConfig } from './config.ts'
import { piHarness } from './harness.ts'
import type { Truncate } from './widget.ts'

export type SessionTitleDeps = {
  configPath: string
  files: Files
  truncate: Truncate
  readConfig?: (path: string) => TitleConfig
  now?: () => number
  newId?: () => string
}

export function modJxfSessionTitle(deps: SessionTitleDeps): (pi: ExtensionAPI) => void {
  const now = deps.now ?? Date.now
  const newId = deps.newId ?? (() => crypto.randomUUID())
  const loadConfig = deps.readConfig ?? readConfig

  return pi => {
    let config = loadConfig(deps.configPath)
    let isActive = true
    const titles = titler(() => config)
    const harness = (ctx: ExtensionContext) =>
      piHarness(pi, ctx, { config, files: deps.files, truncate: deps.truncate, now, newId, isActive: () => isActive })

    pi.registerCommand(COMMAND, {
      description: COMMAND_DESCRIPTION,
      handler: async (_args, ctx) => {
        await titles.regenerate(harness(ctx))
      },
    })

    pi.on('session_start', async (_event, ctx) => {
      config = loadConfig(deps.configPath)
      await titles.restore(harness(ctx))
    })

    pi.on('session_shutdown', () => {
      isActive = false
    })

    pi.on('session_info_changed', async (event, ctx) => {
      await harness(ctx).showTitle(event.name)
    })

    pi.on('before_agent_start', (event, ctx) => {
      if (event.messageType === 'user') {
        void titles.titleFirstPrompt(harness(ctx), event.prompt).catch(() => undefined)
      }
    })
  }
}
