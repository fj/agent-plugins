import { alignRight, type TextWidth } from './paint.ts'

const COLUMN_GAP = 2
const ITEM_SEPARATOR = ' '

function packLeft(items: readonly string[], rights: readonly string[], width: number, measure: TextWidth): string[] | undefined {
  const lefts = rights.map(() => '')
  const fits = (left: string, right: string) => measure.visibleWidth(left) + COLUMN_GAP + measure.visibleWidth(right) <= width
  const extend = (left: string, item: string) => (left === '' ? item : `${left}${ITEM_SEPARATOR}${item}`)
  let row = 0

  for (const item of items) {
    while (row < rights.length && !fits(extend(lefts[row]!, item), rights[row]!)) {
      row += 1
    }

    if (row === rights.length) {
      return undefined
    }

    lefts[row] = extend(lefts[row]!, item)
  }

  return lefts
}

function spread(left: string, right: string, width: number, measure: TextWidth): string {
  if (left === '') {
    return alignRight(right, width, measure)
  }

  const gap = width - measure.visibleWidth(left) - measure.visibleWidth(right)

  return `${left}${' '.repeat(gap)}${right}`
}

export function besideRight(items: readonly string[], rights: readonly string[], width: number, measure: TextWidth): string[] {
  const lefts = packLeft(items, rights, width, measure)
  const aligned = (row: number, right: string) => spread(lefts?.[row] ?? '', right, width, measure)
  const rows = rights.map((right, row) => aligned(row, right))

  return lefts !== undefined || items.length === 0
    ? rows
    : [measure.truncateToWidth(items.join(ITEM_SEPARATOR), width), ...rows]
}
