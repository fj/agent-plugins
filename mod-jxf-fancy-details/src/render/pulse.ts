import { BACKGROUND, PALETTE } from './palette.ts'
import type { Line, Role } from './segment.ts'

export const PULSE_PERIOD_MS = 1200
const WARNING_PULSES = 3
const DIM_COLOR = '#5c1414'
const DIM_BACKGROUND = '#2b0a0a'
const HEX_RADIX = 16
const CHANNEL_WIDTH = 2
const CHANNELS = [1, 3, 5]
const FULL_TURN = 2 * Math.PI

type Pulse = { dim: string; lastsMs: number }

const FOREGROUND_PULSES: Readonly<Partial<Record<Role, Pulse>>> = {
  overage: { dim: DIM_COLOR, lastsMs: Infinity },
}

const BACKGROUND_PULSES: Readonly<Partial<Record<Role, Pulse>>> = {
  warning: { dim: DIM_BACKGROUND, lastsMs: WARNING_PULSES * PULSE_PERIOD_MS },
}

const isLive = (pulse: Pulse | undefined, elapsedMs: number): pulse is Pulse => pulse !== undefined && elapsedMs < pulse.lastsMs

export const pulses = (role: Role, elapsedMs = 0) => isLive(FOREGROUND_PULSES[role], elapsedMs) || isLive(BACKGROUND_PULSES[role], elapsedMs)

export const hasPulse = (line: Line, elapsedMs = 0) => line.some(part => pulses(part.role, elapsedMs))

const channels = (hex: string) => CHANNELS.map(at => parseInt(hex.slice(at, at + CHANNEL_WIDTH), HEX_RADIX))

function mix(from: string, to: string, amount: number): string {
  const target = channels(to)

  return `#${channels(from)
    .map((value, i) => Math.round(value + (target[i]! - value) * amount))
    .map(value => value.toString(HEX_RADIX).padStart(CHANNEL_WIDTH, '0'))
    .join('')}`
}

function shade(bright: string | undefined, pulse: Pulse | undefined, elapsedMs: number | undefined): string | undefined {
  if (bright === undefined || elapsedMs === undefined || !isLive(pulse, elapsedMs)) {
    return bright
  }

  const phase = (elapsedMs % PULSE_PERIOD_MS) / PULSE_PERIOD_MS

  return mix(pulse.dim, bright, (1 + Math.cos(phase * FULL_TURN)) / 2)
}

export const roleColor = (role: Role, elapsedMs?: number) => shade(PALETTE[role], FOREGROUND_PULSES[role], elapsedMs)

export const roleBackground = (role: Role, elapsedMs?: number) => shade(BACKGROUND[role], BACKGROUND_PULSES[role], elapsedMs)

export type PulseClock = (epoch: string, nowMs: number) => number

export function pulseClock(): PulseClock {
  let start: { epoch: string; atMs: number } | undefined

  return (epoch, nowMs) => {
    if (start?.epoch !== epoch) {
      start = { epoch, atMs: nowMs }
    }

    return nowMs - start.atMs
  }
}
