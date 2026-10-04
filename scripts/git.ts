import { execFileSync } from 'node:child_process'

export function git(repo: string, args: string[], env: NodeJS.ProcessEnv = process.env): string {
  return execFileSync('git', ['-C', repo, ...args], { env, encoding: 'utf8' }).trim()
}
