import type { TextWidth } from '../pi/paint.ts'

const ANSI = /\x1b\[[0-9;]*m/g

export const plain = (text: string) => text.replace(ANSI, '')

export const measure: TextWidth = {
  visibleWidth: text => [...plain(text)].length,
  truncateToWidth: (text, maxWidth) => {
    const chars = [...plain(text)]

    return chars.length <= maxWidth ? text : chars.slice(0, maxWidth).join('')
  },
}
