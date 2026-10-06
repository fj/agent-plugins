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
  branch: '#f5a3c7',
  meter: '#f0c674',
}

export const DONE_TIMER_COLOR = '#8a8a8a'
