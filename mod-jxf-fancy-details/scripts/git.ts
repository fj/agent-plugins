import { execFileSync } from 'node:child_process'

export function git(repo: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8' }).trim()
}

export function commitTime(repo: string): Date {
  return new Date(git(repo, ['log', '-1', '--format=%cI']))
}
