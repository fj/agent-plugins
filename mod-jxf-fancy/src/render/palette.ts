import type { Role } from './segment.ts'

export const PALETTE: Readonly<Record<Role, string | undefined>> = {
  plain: undefined,
  muted: '#8a8a8a',
  time: '#b0b0b0',
  label: '#c9a0ff',
  input: '#7fb8ff',
  cache: '#7fd7c4',
  output: '#ffb86b',
  cost: '#9be27f',
  model: '#d7a8ff',
  path: '#8fc7ff',
  meter: '#f0c674',
  robot: '#9ec5f8',
  hat: '#4a4a5a',
  hatBand: '#d0367a',
}

export const DONE_TIMER_COLOR = '#8a8a8a'
