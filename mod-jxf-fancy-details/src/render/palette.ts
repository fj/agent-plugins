import type { Role } from './segment.ts'

const CACHE_COLOR = '#7fd7c4'

export const PALETTE: Readonly<Record<Role, string | undefined>> = {
  plain: undefined,
  muted: '#8a8a8a',
  time: '#b0b0b0',
  label: '#c9a0ff',
  input: '#7fb8ff',
  cache: CACHE_COLOR,
  cacheCountdown: CACHE_COLOR,
  output: '#ffb86b',
  cost: '#9be27f',
  model: '#d7a8ff',
  path: '#8fc7ff',
  branch: '#f5a3c7',
  meter: '#f0c674',
  overage: '#ff4d4d',
  warning: '#ff6b6b',
}

export const BACKGROUND: Readonly<Partial<Record<Role, string>>> = {
  warning: '#8b1a1a',
}

export const DONE_TIMER_COLOR = '#8a8a8a'
