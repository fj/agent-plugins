import type { Cost } from '../core/cost.ts'

const MS_PER_SECOND = 1000
const SECONDS_PER_MINUTE = 60
const SECONDS_PER_HOUR = 3600
const THOUSAND = 1000
const MILLION = 1_000_000
const CENTS_DIGITS = 2

const pad = (n: number, width = 2) => String(n).padStart(width, '0')

export function formatClock(ms: number): string {
  const d = new Date(ms)

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function formatDuration(ms: number): string {
  const tenths = Math.floor(Math.max(0, ms) / (MS_PER_SECOND / 10))
  const totalSeconds = Math.floor(tenths / 10)

  if (totalSeconds < SECONDS_PER_MINUTE) {
    return `${(tenths / 10).toFixed(1)}s`
  }

  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR)
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE)
  const seconds = totalSeconds % SECONDS_PER_MINUTE

  return hours > 0 ? `${hours}h ${pad(minutes)}m` : `${minutes}m ${pad(seconds)}s`
}

export function formatTokens(n: number): string {
  if (n >= MILLION) {
    return `${(n / MILLION).toFixed(1)}M`
  }

  return n >= THOUSAND ? `${(n / THOUSAND).toFixed(1)}k` : String(n)
}

export function formatUsd(cost: Cost): string {
  return `$${cost.usd.toFixed(CENTS_DIGITS)}${cost.isLowerBound ? '+' : ''}`
}

export function shortenPath(path: string, home: string, maxWidth: number): string {
  const tilde = home !== '' && (path === home || path.startsWith(`${home}/`)) ? `~${path.slice(home.length)}` : path

  if (tilde.length <= maxWidth) {
    return tilde
  }

  const parts = tilde.split('/')
  const head = parts.slice(0, 2).join('/')
  const tail = parts.slice(2)

  while (tail.length > 1 && `${head}/…/${tail.join('/')}`.length > maxWidth) {
    tail.shift()
  }

  return `${head}/…/${tail.join('/')}`
}
