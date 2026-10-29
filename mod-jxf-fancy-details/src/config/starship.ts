import { tomlTable } from './toml.ts'

export const STATUS_SYMBOLS = [
  'conflicted',
  'stashed',
  'deleted',
  'renamed',
  'modified',
  'typechanged',
  'staged',
  'untracked',
  'ahead',
  'behind',
  'diverged',
  'up_to_date',
] as const

export type StatusSymbol = (typeof STATUS_SYMBOLS)[number]

export type GitStatusConfig = { format: string; isDisabled: boolean; symbols: Readonly<Record<StatusSymbol, string>> }

type Env = Readonly<Record<string, string | undefined>>

const TABLE = 'git_status'
const CONFIG_ENV = 'STARSHIP_CONFIG'
const DEFAULT_CONFIG_PATH = '.config/starship.toml'

export const DEFAULT_GIT_STATUS: GitStatusConfig = {
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

export function starshipConfigPath(env: Env, home: string): string {
  return env[CONFIG_ENV] ?? `${home}/${DEFAULT_CONFIG_PATH}`
}

export function gitStatusConfig(toml: string | undefined): GitStatusConfig {
  const table = toml === undefined ? {} : tomlTable(toml, TABLE)
  const text = (key: string, fallback: string) => {
    const value = table[key]

    return typeof value === 'string' ? value : fallback
  }

  return {
    format: text('format', DEFAULT_GIT_STATUS.format),
    isDisabled: table.disabled === true,
    symbols: Object.fromEntries(STATUS_SYMBOLS.map(symbol => [symbol, text(symbol, DEFAULT_GIT_STATUS.symbols[symbol])])) as Record<
      StatusSymbol,
      string
    >,
  }
}
