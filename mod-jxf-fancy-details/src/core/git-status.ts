export const SHOW_STATUS = ['git', 'status', '--porcelain=v2', '--branch', '--show-stash']

export type GitStatus = {
  conflicted: number
  stashed: number
  deleted: number
  renamed: number
  modified: number
  staged: number
  untracked: number
  ahead?: number
  behind?: number
}

type GitOutput = { exitCode: number; stdout: string }

export type GitReading = { branch: string | null; status: GitStatus | null }

const NO_GIT: GitReading = { branch: null, status: null }

const EMPTY_STATUS: GitStatus = {
  conflicted: 0,
  stashed: 0,
  deleted: 0,
  renamed: 0,
  modified: 0,
  staged: 0,
  untracked: 0,
}

const BRANCH_HEAD = /^# branch\.head (.+)$/m
const DETACHED = '(detached)'
const AHEAD_BEHIND = /^# branch\.ab \+(\d+) -(\d+)$/
const STASH = /^# stash (\d+)$/
const CHANGED = /^[12] (\S\S) /
const CONFLICTED = 'u '
const UNTRACKED = '? '
const STAGED_CODES = 'MADRCT'

const count = (isCounted: boolean) => (isCounted ? 1 : 0)

function addChange(status: GitStatus, [index, worktree]: string): GitStatus {
  const xy = `${index}${worktree}`

  return {
    ...status,
    deleted: status.deleted + count(xy.includes('D')),
    renamed: status.renamed + count(xy.includes('R')),
    modified: status.modified + count(worktree === 'M' || worktree === 'A'),
    staged: status.staged + count(STAGED_CODES.includes(index)),
  }
}

function addLine(status: GitStatus, line: string): GitStatus {
  const aheadBehind = AHEAD_BEHIND.exec(line)
  const stash = STASH.exec(line)
  const change = CHANGED.exec(line)

  if (aheadBehind !== null) {
    return { ...status, ahead: Number(aheadBehind[1]), behind: Number(aheadBehind[2]) }
  }

  if (stash !== null) {
    return { ...status, stashed: Number(stash[1]) }
  }

  if (change !== null) {
    return addChange(status, change[1]!)
  }

  if (line.startsWith(CONFLICTED)) {
    return { ...status, conflicted: status.conflicted + 1 }
  }

  return line.startsWith(UNTRACKED) ? { ...status, untracked: status.untracked + 1 } : status
}

function parseGitStatus(stdout: string): GitStatus {
  return stdout.split('\n').reduce(addLine, EMPTY_STATUS)
}

function branchOf(stdout: string): string | null {
  const head = BRANCH_HEAD.exec(stdout)?.[1]

  return head === undefined || head === DETACHED ? null : head
}

export function readGit({ exitCode, stdout }: GitOutput): GitReading {
  if (exitCode !== 0) {
    return NO_GIT
  }

  return { branch: branchOf(stdout), status: parseGitStatus(stdout) }
}
