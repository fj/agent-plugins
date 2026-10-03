const PARTIAL_BLOCKS = ['', '▏', '▎', '▍', '▌', '▋', '▊', '▉']
const EIGHTHS = 8
const PERCENT = 100

export function meterBar(percent: number, width: number): string {
  const clamped = Math.max(0, Math.min(PERCENT, percent))
  const eighths = Math.round((clamped / PERCENT) * width * EIGHTHS)
  const full = Math.floor(eighths / EIGHTHS)
  const partial = PARTIAL_BLOCKS[eighths % EIGHTHS] ?? ''
  const empty = width - full - (partial === '' ? 0 : 1)

  return `▕${'█'.repeat(full)}${partial}${' '.repeat(empty)}▏`
}
