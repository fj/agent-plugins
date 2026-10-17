export type AgentState = 'busy' | 'waiting' | 'done'

const TRAILING_DECORATION = /[\s*_`)"'\]]+$/

export function endsWithQuestion(text: string): boolean {
  return text.replace(TRAILING_DECORATION, '').endsWith('?')
}

export function stateAfterAnswer(answer: string): AgentState {
  return endsWithQuestion(answer) ? 'waiting' : 'done'
}
