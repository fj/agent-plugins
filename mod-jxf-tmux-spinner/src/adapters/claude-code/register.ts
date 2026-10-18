import type { EngineInterface, Register } from 'claude-code'

import { stateAfterAnswer, type AgentState } from '../../core/state.ts'
import { identityArgv, stateArgv, tmuxPane } from '../../core/tmux.ts'

const HARNESS = 'claude'
const QUESTION_TOOLS = ['AskUserQuestion', 'ExitPlanMode']

let isWaiting = false

async function runInPane($: EngineInterface, argvFor: (pane: string) => string[]): Promise<void> {
  const pane = tmuxPane(await $.env.get('TMUX'), await $.env.get('TMUX_PANE'))

  if (pane !== undefined) {
    await $.process.run(argvFor(pane))
  }
}

async function show($: EngineInterface, state: AgentState | undefined): Promise<void> {
  isWaiting = state === 'waiting'
  await runInPane($, pane => stateArgv(pane, state))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await show($, undefined)
    const session = await $.session.id()
    await runInPane($, pane => identityArgv(pane, { harness: HARNESS, session }))
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await show($, undefined)
    await runInPane($, pane => identityArgv(pane, undefined))
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    await show($, 'busy')
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await show($, stateAfterAnswer(e.answer))
    }

    return next(e)
  })

  for (const tool of QUESTION_TOOLS) {
    on('tool.call', { tool }, async ($, e, next) => {
      await show($, 'waiting')
      return next(e)
    })
  }

  on('classic.PermissionRequest', async ($, e, next) => {
    await show($, 'waiting')
    return next(e)
  })

  on('classic.Elicitation', async ($, e, next) => {
    await show($, 'waiting')
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const result = await next(e)

    if (isWaiting) {
      await show($, 'busy')
    }

    return result
  })
}
