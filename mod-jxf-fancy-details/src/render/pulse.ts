import { BACKGROUND, DIM_BACKGROUND, PALETTE } from './palette.ts'
import type { Line, Role } from './segment.ts'

export const PULSE_PERIOD_MS = 1200
const DIM_COLOR = '#5c1414'
const HEX_RADIX = 16
const CHANNEL_WIDTH = 2
const CHANNELS = [1, 3, 5]
const FULL_TURN = 2 * Math.PI

const PULSING_ROLES: ReadonlySet<Role> = new Set(['overage'])
const PULSING_BACKGROUNDS: ReadonlySet<Role> = new Set(['warning'])

export const pulses = (role: Role) => PULSING_ROLES.has(role) || PULSING_BACKGROUNDS.has(role)

export const hasPulse = (line: Line) => line.some(part => pulses(part.role))

const channels = (hex: string) => CHANNELS.map(at => parseInt(hex.slice(at, at + CHANNEL_WIDTH), HEX_RADIX))

function mix(from: string, to: string, amount: number): string {
  const target = channels(to)

  return `#${channels(from)
    .map((value, i) => Math.round(value + (target[i]! - value) * amount))
    .map(value => value.toString(HEX_RADIX).padStart(CHANNEL_WIDTH, '0'))
    .join('')}`
}

function swell(dim: string, bright: string, nowMs: number): string {
  const phase = (nowMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS

  return mix(dim, bright, (1 + Math.cos(phase * FULL_TURN)) / 2)
}

export function roleColor(role: Role, nowMs?: number): string | undefined {
  const bright = PALETTE[role]

  return bright === undefined || nowMs === undefined || !PULSING_ROLES.has(role) ? bright : swell(DIM_COLOR, bright, nowMs)
}

export function roleBackground(role: Role, nowMs?: number): string | undefined {
  const bright = BACKGROUND[role]

  return bright === undefined || nowMs === undefined || !PULSING_BACKGROUNDS.has(role) ? bright : swell(DIM_BACKGROUND, bright, nowMs)
}
