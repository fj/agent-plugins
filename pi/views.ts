import { markStep, type LedgerState } from '../src/core/ledger.ts'
import { messagePrefix } from '../src/render/prefix.ts'
import { topHat } from '../src/render/hat.ts'
import { promptTimerView, timerView } from '../src/render/timer.ts'
import type { UsageStrategy } from '../src/strategies/usage/strategy.ts'
import { chatLine, paintLine, paintTimer, type TextWidth } from './paint.ts'

export type Scene = {
  ledger(): LedgerState
  now(): number
  usage(): UsageStrategy
  measure: TextWidth
}

export type View = { render(width: number): string[]; invalidate(): void }

export function view(render: (width: number) => string[]): View {
  return { render, invalidate() {} }
}

export function promptLines(scene: Scene, id: string, width: number): string[] {
  const ledger = scene.ledger()
  const prompt = ledger.prompts[id]

  if (prompt === undefined) {
    return []
  }

  const now = scene.now()
  const timer = promptTimerView(prompt, ledger.currentPromptId === id, now)

  return ['', chatLine(paintTimer(timer, now), width, scene.measure)]
}

export function stepLines(scene: Scene, id: string, width: number): string[] {
  const ledger = scene.ledger()
  const mark = ledger.marks[id]

  if (mark === undefined) {
    return []
  }

  const prefix = messagePrefix({ mark, step: markStep(ledger, id), now: scene.now(), usage: scene.usage() })

  return ['', chatLine(paintLine(prefix), width, scene.measure)]
}

export function toolTimerLine(scene: Scene, id: string, width: number): string | undefined {
  const mark = scene.ledger().marks[id]

  if (mark?.kind !== 'tool') {
    return undefined
  }

  const now = scene.now()

  return chatLine(paintTimer(timerView(mark.startedAt, now, mark.endedAt), now), width, scene.measure)
}

export function hatLines(width: number, measure: TextWidth): string[] {
  return topHat().map(line => chatLine(paintLine(line), width, measure))
}
