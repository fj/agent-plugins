import type { GitStatus } from '../core/git-status.ts'

type Counted = Exclude<keyof GitStatus, 'ahead' | 'behind'>

const COUNTED_SYMBOLS: readonly (readonly [Counted, string])[] = [
  ['conflicted', '⇄'],
  ['stashed', '■'],
  ['deleted', '×'],
  ['renamed', '»'],
  ['modified', '!'],
  ['staged', '+'],
  ['untracked', '?'],
]
const AHEAD = '⇡'
const BEHIND = '⇣'
const DIVERGED = '⇕'
const UP_TO_DATE = '✓'

const counted = (symbol: string, count: number) => `${symbol}⟨${count}⟩`

function changes(status: GitStatus): string {
  return COUNTED_SYMBOLS.filter(([name]) => status[name] > 0)
    .map(([name, symbol]) => counted(symbol, status[name]))
    .join('')
}

function aheadBehind({ ahead, behind }: GitStatus): string {
  if (ahead === undefined || behind === undefined) {
    return ''
  }

  if (ahead > 0 && behind > 0) {
    return `${DIVERGED} ${AHEAD}${ahead} ${BEHIND}${behind}`
  }

  if (ahead > 0) {
    return counted(AHEAD, ahead)
  }

  return behind > 0 ? counted(BEHIND, behind) : UP_TO_DATE
}

export function gitStatusText(status: GitStatus): string {
  return `${changes(status)}${aheadBehind(status)}`
}
