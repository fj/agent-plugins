import type { Run } from './run.ts'

export type PiPackage = { source: string; path?: string }

const ANSI = /\x1b\[[0-9;]*m/g
const USER_HEADER = 'User packages:'
const SOURCE_LINE = /^ {2}(\S.*)$/
const PATH_LINE = /^ {4}(\S.*)$/
const FILTERED = / \(filtered\)$/
const GIT_PREFIX = 'git:'
const URL_SCHEME = /^(https?|ssh):\/\//

export function listPiPackages(run: Run): PiPackage[] {
  const packages: PiPackage[] = []
  let inUserSection = false

  for (const line of run('pi', ['list', '--no-approve']).replace(ANSI, '').split('\n')) {
    if (!line.startsWith(' ')) {
      inUserSection = line === USER_HEADER
      continue
    }
    if (!inUserSection) continue
    const path = PATH_LINE.exec(line)?.[1]
    const source = SOURCE_LINE.exec(line)?.[1]
    if (path && packages.length) packages.at(-1)!.path = path
    else if (source) packages.push({ source: source.replace(FILTERED, '') })
  }
  return packages
}

export function gitRepoOf(source: string): string | undefined {
  if (!source.startsWith(GIT_PREFIX) && !URL_SCHEME.test(source)) return undefined
  const location = source
    .replace(GIT_PREFIX, '')
    .replace(URL_SCHEME, '')
    .replace(/^git@/, '')
    .replace(/^([^/:]+):/, '$1/')
  const segments = location.split('/')
  const repo = segments.pop()!.split('@')[0]!.replace(/\.git$/, '')
  return [...segments, repo].join('/')
}

export const removePi = (run: Run, source: string) => run('pi', ['remove', source])
export const installPi = (run: Run, source: string) => run('pi', ['install', source])
