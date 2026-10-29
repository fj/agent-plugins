import type { GitStatusConfig, StatusSymbol } from '../render/git-status.ts'
import { tomlTable } from './toml.ts'

type Env = Readonly<Record<string, string | undefined>>

const TABLE = 'git_status'
const CONFIG_ENV = 'STARSHIP_CONFIG'
const DEFAULT_CONFIG_PATH = '.config/starship.toml'

const DEFAULT_GIT_STATUS: GitStatusConfig = {
  format: '$all_status$ahead_behind',
  isDisabled: false,
  symbols: {
    conflicted: '=',
    stashed: '\\$',
    deleted: '✘',
    renamed: '»',
    modified: '!',
    typechanged: '',
    staged: '+',
    untracked: '?',
    ahead: '⇡',
    behind: '⇣',
    diverged: '⇕',
    up_to_date: '',
  },
}

const SYMBOLS = Object.keys(DEFAULT_GIT_STATUS.symbols) as StatusSymbol[]

export function starshipConfigPath(env: Env, home: string): string {
  return env[CONFIG_ENV] ?? `${home}/${DEFAULT_CONFIG_PATH}`
}

export function gitStatusConfig(toml: string | undefined): GitStatusConfig {
  const table = toml === undefined ? {} : tomlTable(toml, TABLE)
  const text = (key: string, fallback: string) => {
    const value = table[key]

    return typeof value === 'string' ? value : fallback
  }
  const symbols = Object.fromEntries(SYMBOLS.map(symbol => [symbol, text(symbol, DEFAULT_GIT_STATUS.symbols[symbol])]))

  return {
    format: text('format', DEFAULT_GIT_STATUS.format),
    isDisabled: table.disabled === true,
    symbols: symbols as Record<StatusSymbol, string>,
  }
}
