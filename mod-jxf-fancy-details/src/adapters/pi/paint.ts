import { DONE_TIMER_COLOR } from '../../render/palette.ts'
import { roleBackground, roleColor } from '../../render/pulse.ts'
import type { Line } from '../../render/segment.ts'
import { shimmer } from '../../render/shimmer.ts'
import type { TimerView } from '../../render/timer.ts'

export type TextWidth = {
  visibleWidth(text: string): number
  truncateToWidth(text: string, maxWidth: number): string
  wrapTextWithAnsi(text: string, width: number): string[]
}

const HEX_COLOR = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i
const HEX_RADIX = 16
const FOREGROUND_LAYER = 38
const BACKGROUND_LAYER = 48
const RESET_FOREGROUND = '\x1b[39m'
const RESET_BACKGROUND = '\x1b[49m'
const RESET_STYLE = '\x1b[0m'
const CHAT_INDENT = ' '

export function endStyle(text: string): string {
  return `${text}${RESET_STYLE}`
}

function colorize(text: string, hex: string | undefined, layer: number, reset: string): string {
  const match = hex === undefined ? null : HEX_COLOR.exec(hex)

  if (match === null || text === '') {
    return text
  }

  const [r, g, b] = match.slice(1).map(channel => parseInt(channel, HEX_RADIX))

  return `\x1b[${layer};2;${r};${g};${b}m${text}${reset}`
}

export function paint(text: string, hex: string | undefined): string {
  return colorize(text, hex, FOREGROUND_LAYER, RESET_FOREGROUND)
}

function paintBackground(text: string, hex: string | undefined): string {
  return colorize(text, hex, BACKGROUND_LAYER, RESET_BACKGROUND)
}

export function paintLine(line: Line, nowMs?: number): string {
  return line.map(part => paintBackground(paint(part.text, roleColor(part.role, nowMs)), roleBackground(part.role, nowMs))).join('')
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

export function alignRight(text: string, width: number, measure: TextWidth): string {
  const used = measure.visibleWidth(text)

  return used >= width ? measure.truncateToWidth(text, width) : `${' '.repeat(width - used)}${text}`
}
