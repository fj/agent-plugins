import { formatRemaining } from './format.ts'
import { seg, type Line, type Segment } from './segment.ts'

export const hasCacheCountdown = (line: Line) => line.some(part => part.role === 'cacheCountdown')

export const cacheCountdownSegment = (remainingMs: number): Segment =>
  seg(formatRemaining(remainingMs), remainingMs > 0 ? 'cacheCountdown' : 'muted')

export function countCacheDown(line: Line, remainingMs: number): Line {
  return line.map(part => (part.role === 'cacheCountdown' ? cacheCountdownSegment(remainingMs) : part))
}
