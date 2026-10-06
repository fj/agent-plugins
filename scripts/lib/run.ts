import { execFileSync, spawnSync } from 'node:child_process'

export type RunOptions = { cwd?: string; env?: NodeJS.ProcessEnv }
export type Run = (command: string, args: string[], options?: RunOptions) => string

export const run: Run = (command, args, { cwd, env } = {}) =>
  execFileSync(command, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }).trim()

export function shell(command: string, cwd: string): void {
  const { status, error } = spawnSync('sh', ['-c', command], { cwd, stdio: ['ignore', 'inherit', 'inherit'] })
  if (error) throw error
  if (status !== 0) throw new Error(`"${command}" failed in ${cwd} with exit code ${status}`)
}

export function quote(arg: string): string {
  return `'${arg.replaceAll("'", `'\\''`)}'`
}
