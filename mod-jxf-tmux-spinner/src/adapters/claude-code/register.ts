import type { EngineInterface, Register } from 'claude-code'

import { stateAfterAnswer, type AgentState } from '../../core/state.ts'
import { stateArgv, tmuxPane } from '../../core/tmux.ts'

const QUESTION_TOOLS = ['AskUserQuestion', 'ExitPlanMode']

let isWaiting = false

async function show($: EngineInterface, state: AgentState | undefined): Promise<void> {
  isWaiting = state === 'waiting'
  const pane = tmuxPane(await $.env.get('TMUX'), await $.env.get('TMUX_PANE'))

  if (pane !== undefined) {
    await $.process.run(stateArgv(pane, state))
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await show($, undefined)
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await show($, undefined)
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
