import { DONE_TIMER_COLOR, PALETTE } from '../../render/palette.ts'
import type { Line } from '../../render/segment.ts'
import { shimmer } from '../../render/shimmer.ts'
import type { TimerView } from '../../render/timer.ts'

export type TextWidth = {
  visibleWidth(text: string): number
  truncateToWidth(text: string, maxWidth: number): string
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const HEX_RADIX = 16
const RESET_FOREGROUND = '\x1b[39m'
const CHAT_INDENT = ' '

export function paint(text: string, hex: string | undefined): string {
  const match = hex === undefined ? null : HEX_COLOR.exec(hex)

  if (match === null || text === '') {
    return text
  }

  const [r, g, b] = match.slice(1).map(channel => parseInt(channel, HEX_RADIX))

  return `\x1b[38;2;${r};${g};${b}m${text}${RESET_FOREGROUND}`
}

export function paintLine(line: Line): string {
  return line.map(part => paint(part.text, PALETTE[part.role])).join('')
}

export function paintTimer(view: TimerView, now: number): string {
  return view.isLive
    ? shimmer(view.text, now)
        .map(({ char, color }) => paint(char, color))
        .join('')
    : paint(view.text, DONE_TIMER_COLOR)
}

export function chatLine(text: string, width: number, measure: TextWidth): string {
  return measure.truncateToWidth(`${CHAT_INDENT}${text}`, width)
}

export function alignRight(text: string, width: number, measure: TextWidth, left = ''): string {
  const used = measure.visibleWidth(text)
  const leftWidth = measure.visibleWidth(left)

  if (used >= width) {
    return measure.truncateToWidth(text, width)
  }

  const showLeft = left !== '' && leftWidth + 1 + used <= width
  const gap = width - used - (showLeft ? leftWidth : 0)

  return `${showLeft ? left : ''}${' '.repeat(gap)}${text}`
}
