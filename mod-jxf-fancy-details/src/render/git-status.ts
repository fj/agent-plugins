import type { GitStatus } from '../core/git-status.ts'
import { renderFormat, type Lookup } from './starship-format.ts'

const COUNTED = ['conflicted', 'stashed', 'deleted', 'renamed', 'modified', 'typechanged', 'staged', 'untracked'] as const

type Counted = (typeof COUNTED)[number]

export type StatusSymbol = Counted | 'ahead' | 'behind' | 'diverged' | 'up_to_date'

export type GitStatusConfig = { format: string; isDisabled: boolean; symbols: Readonly<Record<StatusSymbol, string>> }

const ALL_STATUS = COUNTED.map(name => `$${name}`).join('')

const counts =
  (values: Readonly<Record<string, number>>): Lookup =>
  name =>
    values[name]?.toString() ?? ''

function aheadBehind(status: GitStatus, { symbols }: GitStatusConfig): string {
  const { ahead, behind } = status

  if (ahead === undefined || behind === undefined) {
    return ''
  }

  if (ahead > 0 && behind > 0) {
    return renderFormat(symbols.diverged, counts({ ahead_count: ahead, behind_count: behind }))
  }

  if (ahead > 0) {
    return renderFormat(symbols.ahead, counts({ count: ahead }))
  }

  return behind > 0 ? renderFormat(symbols.behind, counts({ count: behind })) : renderFormat(symbols.up_to_date, counts({}))
}

function statusLookup(status: GitStatus, config: GitStatusConfig): Lookup {
  const lookup: Lookup = name => {
    if (name === 'all_status') {
      return renderFormat(ALL_STATUS, lookup)
    }

    if (name === 'ahead_behind') {
      return aheadBehind(status, config)
    }

    const counted = COUNTED.find(key => key === name)

    return counted === undefined || status[counted] === 0 ? '' : renderFormat(config.symbols[counted], counts({ count: status[counted] }))
  }

  return lookup
}

export function gitStatusText(status: GitStatus, config: GitStatusConfig): string {
  return config.isDisabled ? '' : renderFormat(config.format, statusLookup(status, config)).trim()
}
