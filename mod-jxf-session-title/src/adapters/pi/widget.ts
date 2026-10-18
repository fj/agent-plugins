import { FRAME_MS, progressText, spinnerFrame } from '../../render/progress.ts'

export type Truncate = (text: string, maxWidth: number) => string

export type WidgetTheme = { fg(color: 'accent' | 'muted', text: string): string }

export type Renderable = { requestRender(): void }

type WidgetComponent = { render(width: number): string[]; invalidate(): void; dispose(): void }

const INDENT = ' '

export function titleWidget(title: string, theme: WidgetTheme, truncate: Truncate): WidgetComponent {
  return {
    render: width => [truncate(`${INDENT}${theme.fg('muted', title)}`, width)],
    invalidate() {},
    dispose() {},
  }
}

export type ProgressInput = { modelLabel: string; startedAt: number; now: () => number }

export function progressWidget(tui: Renderable, theme: WidgetTheme, truncate: Truncate, input: ProgressInput): WidgetComponent {
  const timer = setInterval(() => tui.requestRender(), FRAME_MS)

  return {
    render(width) {
      const elapsed = input.now() - input.startedAt
      const line = `${INDENT}${theme.fg('accent', spinnerFrame(elapsed))} ${theme.fg('muted', progressText(input.modelLabel, elapsed))}`

      return [truncate(line, width)]
    },
    invalidate() {},
    dispose: () => clearInterval(timer),
  }
}
