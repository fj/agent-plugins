import type { AgentState } from './state.ts'

export const STATE_OPTION = '@agent_state'

export function tmuxPane(tmux: string | undefined, pane: string | undefined): string | undefined {
  return tmux && pane ? pane : undefined
}

export function stateArgv(pane: string, state: AgentState | undefined): string[] {
  return state === undefined
    ? ['tmux', 'set-option', '-wu', '-t', pane, STATE_OPTION]
    : ['tmux', 'set-option', '-w', '-t', pane, STATE_OPTION, state]
}
