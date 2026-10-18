import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

import { stateAfterAnswer, type AgentState } from '../../core/state.ts'
import { identityArgv, stateArgv, type Identity } from '../../core/tmux.ts'

const HARNESS = 'pi'

export type SpinnerDeps = {
  pane: string | undefined
  run: (argv: readonly string[]) => Promise<void>
}

type Block = { type: string; text?: string }
type Message = { role: string; content?: string | readonly Block[] }

function textOf(message: Message): string {
  const { content = '' } = message

  return typeof content === 'string'
    ? content
    : content.flatMap(block => (block.type === 'text' && block.text !== undefined ? [block.text] : [])).join('')
}

function lastAnswer(messages: readonly unknown[]): string {
  const answer = (messages as readonly Message[]).findLast(message => message.role === 'assistant')

  return answer === undefined ? '' : textOf(answer)
}

export function modJxfTmuxSpinner({ pane, run }: SpinnerDeps): (pi: ExtensionAPI) => void {
  return pi => {
    if (pane === undefined) {
      return
    }

    let isRunning = false
    let answer = ''

    const show = (state: AgentState | undefined) => run(stateArgv(pane, state))
    const announce = (identity: Identity | undefined) => run(identityArgv(pane, identity))

    pi.on('session_start', async (_event, ctx) => {
      await show(undefined)
      await announce({ harness: HARNESS, session: ctx.sessionManager.getSessionFile() ?? '' })
    })

    pi.on('session_shutdown', async () => {
      await show(undefined)
      await announce(undefined)
    })

    pi.on('agent_start', async () => {
      isRunning = true
      await show('busy')
    })

    pi.on('ui_prompt_start', async () => {
      if (isRunning) {
        await show('waiting')
      }
    })

    pi.on('ui_prompt_end', async () => {
      if (isRunning) {
        await show('busy')
      }
    })

    pi.on('agent_end', async event => {
      answer = lastAnswer(event.messages)
    })

    pi.on('agent_settled', async event => {
      isRunning = false
      await show(event.aborted ? 'done' : stateAfterAnswer(answer))
    })
  }
}
