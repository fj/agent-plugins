import { alignRight, endStyle, type TextWidth } from './paint.ts'

export const COLUMN_GAP = 2
export const MIN_LEFT_WIDTH = 16

function spread(left: string, right: string, width: number, measure: TextWidth): string {
  if (left === '') {
    return alignRight(right, width, measure)
  }

  if (right === '') {
    return endStyle(left)
  }

  const gap = width - measure.visibleWidth(left) - measure.visibleWidth(right)

  return `${endStyle(left)}${' '.repeat(gap)}${right}`
}

export function besideRight(left: string, rights: readonly string[], width: number, measure: TextWidth): string[] {
  const aligned = rights.map(right => alignRight(right, width, measure))

  if (left === '') {
    return aligned
  }

  const rightWidth = Math.max(0, ...rights.map(right => measure.visibleWidth(right)))
  const leftWidth = width - rightWidth - COLUMN_GAP

  if (leftWidth < MIN_LEFT_WIDTH) {
    return [...measure.wrapTextWithAnsi(left, width), ...aligned]
  }

  const lefts = measure.wrapTextWithAnsi(left, leftWidth)
  const rows = Math.max(lefts.length, rights.length)

  return Array.from({ length: rows }, (_, row) => spread(lefts[row] ?? '', rights[row] ?? '', width, measure))
}
