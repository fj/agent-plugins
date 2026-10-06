import { execFileSync } from 'node:child_process'

const ARCHIVE_MAX_BYTES = 1024 ** 3

export const MAIN = 'main'
export const ORIGIN = 'origin'

export function git(dir: string, args: string[]): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

export function tryGit(dir: string, args: string[]): string | undefined {
  try {
    return git(dir, args)
  } catch {
    return undefined
  }
}

export function requireClean(dir: string): void {
  if (git(dir, ['status', '--porcelain'])) throw new Error(`${dir} has uncommitted changes; commit or stash them first`)
}

export function headSha(dir: string): string {
  return git(dir, ['rev-parse', 'HEAD'])
}

export function lastChange(root: string, path: string): Date {
  const time = git(root, ['log', '-1', '--format=%cI', 'HEAD', '--', path])
  if (!time) throw new Error(`${path} has no commits at HEAD`)
  return new Date(time)
}

export function showAtHead(root: string, path: string): string {
  return git(root, ['show', `HEAD:${path}`])
}

export function topLevelDirsAtHead(root: string): string[] {
  return git(root, ['ls-tree', '-d', '--name-only', 'HEAD']).split('\n').filter(Boolean)
}

export function exportAtHead(root: string, path: string, dest: string): void {
  const archive = execFileSync('git', ['-C', root, 'archive', '--format=tar', 'HEAD', '--', path], {
    maxBuffer: ARCHIVE_MAX_BYTES,
  })
  execFileSync('tar', ['-x', '-C', dest], { input: archive })
}
