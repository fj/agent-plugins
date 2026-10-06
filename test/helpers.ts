import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { TestContext } from 'node:test'

import type { Run, RunOptions } from '../scripts/lib/run.ts'

const GIT_CONFIG = `[user]
  name = Test
  email = test@example.com
[init]
  defaultBranch = main
[protocol "file"]
  allow = always
[commit]
  gpgsign = false
[tag]
  gpgsign = false
[advice]
  detachedHead = false
`

const configDir = mkdtempSync(join(tmpdir(), 'agent-plugins-gitconfig-'))
writeFileSync(join(configDir, 'gitconfig'), GIT_CONFIG)
process.env.GIT_CONFIG_GLOBAL = join(configDir, 'gitconfig')
process.env.GIT_CONFIG_NOSYSTEM = '1'
process.on('exit', () => rmSync(configDir, { recursive: true, force: true }))

export async function tempDir(t: TestContext): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'agent-plugins-test-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  return dir
}

export async function writeFiles(dir: string, files: Record<string, string>): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), content)
  }
}

export function gitIn(dir: string, args: string[], env: NodeJS.ProcessEnv = {}): string {
  return execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: { ...process.env, ...env } }).trim()
}

export function commitAll(dir: string, message: string, date: string): void {
  gitIn(dir, ['add', '--all'])
  gitIn(dir, ['commit', '--quiet', '--message', message], { GIT_AUTHOR_DATE: date, GIT_COMMITTER_DATE: date })
}

export async function makeRepo(dir: string, files: Record<string, string>, date: string): Promise<string> {
  mkdirSync(dir, { recursive: true })
  gitIn(dir, ['init', '--quiet'])
  await writeFiles(dir, files)
  commitAll(dir, 'initial', date)
  return dir
}

export function manifest(name: string, fields: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name,
    description: `The ${name} plugin.`,
    version: '0.1',
    author: { name: 'Test Author' },
    harnesses: ['claude', 'pi'],
    ...fields,
  })
}

export type FakeRunner = { run: Run; calls: string[]; options: RunOptions[] }

export function fakeRunner(outputs: Record<string, string> = {}): FakeRunner {
  const calls: string[] = []
  const options: RunOptions[] = []
  const run: Run = (command, args, opts = {}) => {
    const call = [command, ...args].join(' ')
    calls.push(call)
    options.push(opts)
    return outputs[call] ?? ''
  }
  return { run, calls, options }
}
