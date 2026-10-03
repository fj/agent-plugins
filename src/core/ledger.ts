import type { Cost } from './cost.ts'
import { addTotals, ZERO_TOTALS, type Totals } from './totals.ts'
import type { TokenUsage } from './usage.ts'
import { ZERO_COST } from './cost.ts'
import { ZERO_USAGE } from './usage.ts'

export type Pricer = (model: string, usage: TokenUsage) => Cost

export type Prompt = { id: string; turn: number; submittedAt: number; firstReplyAt?: number }

export type Step = {
  id: string
  turn: number
  startedAt: number
  model: string
  endedAt?: number
  usage?: TokenUsage
  cost?: Cost
  totals?: Totals
}

export type MarkKind = 'message' | 'tool'

export type Mark = {
  id: string
  kind: MarkKind
  turn: number
  seq: number
  startedAt: number
  stepId?: string
  endedAt?: number
}

export type LedgerState = {
  turn: number
  seq: number
  prompts: Readonly<Record<string, Prompt>>
  steps: Readonly<Record<string, Step>>
  marks: Readonly<Record<string, Mark>>
  currentPromptId?: string
  currentStepId?: string
  totals: Totals
}

export const EMPTY_LEDGER: LedgerState = {
  turn: 0,
  seq: 0,
  prompts: {},
  steps: {},
  marks: {},
  totals: ZERO_TOTALS,
}

export function submitPrompt(state: LedgerState, id: string, at: number): LedgerState {
  const turn = state.turn + 1
  const prompt: Prompt = { id, turn, submittedAt: at }

  return { ...state, turn, seq: 0, currentPromptId: id, prompts: { ...state.prompts, [id]: prompt } }
}

export function startStep(state: LedgerState, id: string, at: number, model: string): LedgerState {
  const step: Step = { id, turn: state.turn, startedAt: at, model }

  return { ...state, currentStepId: id, steps: { ...state.steps, [id]: step } }
}

export function markReply(state: LedgerState, at: number): LedgerState {
  const prompt = state.currentPromptId === undefined ? undefined : state.prompts[state.currentPromptId]

  if (prompt === undefined || prompt.firstReplyAt !== undefined) {
    return state
  }

  return { ...state, prompts: { ...state.prompts, [prompt.id]: { ...prompt, firstReplyAt: at } } }
}

export function addMark(state: LedgerState, id: string, kind: MarkKind, at: number): LedgerState {
  if (state.marks[id] !== undefined) {
    return state
  }

  const seq = state.seq + 1
  const mark: Mark = { id, kind, turn: state.turn, seq, startedAt: at, stepId: state.currentStepId }

  return markReply({ ...state, seq, marks: { ...state.marks, [id]: mark } }, at)
}

export function endMark(state: LedgerState, id: string, at: number): LedgerState {
  const mark = state.marks[id]

  return mark === undefined ? state : { ...state, marks: { ...state.marks, [id]: { ...mark, endedAt: at } } }
}

export function completeStep(
  state: LedgerState,
  id: string,
  usage: TokenUsage,
  at: number,
  price: Pricer,
): LedgerState {
  const step = state.steps[id]

  if (step === undefined) {
    return state
  }

  const cost = price(step.model, usage)
  const totals = addTotals(state.totals, { usage, cost, activeMs: 0 })
  const done: Step = { ...step, endedAt: at, usage, cost, totals }

  return { ...state, totals, steps: { ...state.steps, [id]: done } }
}

export function finishStep(
  state: LedgerState,
  id: string,
  usage: TokenUsage,
  at: number,
  price: Pricer,
): LedgerState {
  const isOpenMessage = (mark: Mark) => mark.stepId === id && mark.kind === 'message' && mark.endedAt === undefined
  const open = Object.values(state.marks).filter(isOpenMessage)
  const done = open.reduce((next, mark) => endMark(next, mark.id, at), completeStep(state, id, usage, at, price))

  return markReply(done, at)
}

export function completeTurn(state: LedgerState, at: number): { state: LedgerState; delta: Totals } {
  const prompt = state.currentPromptId === undefined ? undefined : state.prompts[state.currentPromptId]
  const activeMs = prompt === undefined ? 0 : Math.max(0, at - prompt.submittedAt)
  const delta: Totals = { usage: ZERO_USAGE, cost: ZERO_COST, activeMs }

  return {
    state: { ...state, currentPromptId: undefined, totals: addTotals(state.totals, delta) },
    delta,
  }
}

export function markStep(state: LedgerState, markId: string): Step | undefined {
  const stepId = state.marks[markId]?.stepId

  return stepId === undefined ? undefined : state.steps[stepId]
}
