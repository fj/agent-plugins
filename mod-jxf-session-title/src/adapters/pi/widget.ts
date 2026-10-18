import { FRAME_MS, progressText, spinnerFrame } from '../../render/progress.ts'

export type TextFit = {
  truncate(text: string, maxWidth: number): string
  width(text: string): number
}

export type WidgetTheme = { fg(color: 'accent' | 'muted', text: string): string }

export type Renderable = { requestRender(): void }

type WidgetComponent = { render(width: number): string[]; invalidate(): void; dispose(): void }

const MARGIN = ' '

function alignRight(fit: TextFit, text: string, width: number): string {
  const line = `${text}${MARGIN}`
  const slack = width - fit.width(line)

  return slack > 0 ? `${' '.repeat(slack)}${line}` : fit.truncate(line, width)
}

export function titleWidget(title: string, theme: WidgetTheme, fit: TextFit): WidgetComponent {
  return {
    render: width => [alignRight(fit, theme.fg('muted', title), width)],
    invalidate() {},
    dispose() {},
  }
}

export type ProgressInput = { modelLabel: string; startedAt: number; now: () => number }

export function progressWidget(tui: Renderable, theme: WidgetTheme, fit: TextFit, input: ProgressInput): WidgetComponent {
  const timer = setInterval(() => tui.requestRender(), FRAME_MS)

  return {
    render(width) {
      const elapsed = input.now() - input.startedAt
      const text = `${theme.fg('accent', spinnerFrame(elapsed))} ${theme.fg('muted', progressText(input.modelLabel, elapsed))}`

      return [alignRight(fit, text, width)]
    },
    invalidate() {},
    dispose: () => clearInterval(timer),
  }
}
