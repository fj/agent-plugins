export const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const FRAME_MS = 80

const MS_PER_SECOND = 1000

export function spinnerFrame(elapsedMs: number): string {
  const frame = Math.floor(Math.max(0, elapsedMs) / FRAME_MS) % SPINNER_FRAMES.length

  return SPINNER_FRAMES[frame]!
}

export function progressText(modelLabel: string, elapsedMs: number): string {
  const seconds = (Math.max(0, elapsedMs) / MS_PER_SECOND).toFixed(1)

  return `asking ${modelLabel} to summarize prompt for session title [${seconds}s]`
}
