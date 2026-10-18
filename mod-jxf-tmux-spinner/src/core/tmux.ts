import type { AgentState } from './state.ts'

export const STATE_OPTION = '@agent_state'
export const HARNESS_OPTION = '@agent_harness'
export const SESSION_OPTION = '@agent_session'

export type Identity = { harness: string; session: string }

const COMMAND_SEPARATOR = ';'

export function tmuxPane(tmux: string | undefined, pane: string | undefined): string | undefined {
  return tmux && pane ? pane : undefined
}

function optionArgs(pane: string, option: string, value: string | undefined): string[] {
  return value === undefined ? ['set-option', '-wu', '-t', pane, option] : ['set-option', '-w', '-t', pane, option, value]
}

export function stateArgv(pane: string, state: AgentState | undefined): string[] {
  return ['tmux', ...optionArgs(pane, STATE_OPTION, state)]
}

export function identityArgv(pane: string, identity: Identity | undefined): string[] {
  return [
    'tmux',
    ...optionArgs(pane, HARNESS_OPTION, identity?.harness),
    COMMAND_SEPARATOR,
    ...optionArgs(pane, SESSION_OPTION, identity?.session),
  ]
}
