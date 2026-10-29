import assert from 'node:assert/strict'
import { test } from 'node:test'

import { readGit } from '../src/core/git-status.ts'

const NOT_A_REPO = 128
const HASH = '0123456789abcdef0123456789abcdef01234567'
const MODES = '100644 100644 100644'
const changed = (xy: string, path: string) => `1 ${xy} N... ${MODES} ${HASH} ${HASH} ${path}`
const renamed = (xy: string, path: string, from: string) => `2 ${xy} N... ${MODES} ${HASH} ${HASH} R100 ${path}\t${from}`
const conflicted = (path: string) => `u UU N... ${MODES} 100644 ${HASH} ${HASH} ${HASH} ${path}`

const PORCELAIN = [
  `# branch.oid ${HASH}`,
  '# branch.head main',
  '# branch.upstream origin/main',
  '# branch.ab +2 -3',
  '# stash 4',
  changed('.M', 'worktree-modified.ts'),
  changed('M.', 'index-modified.ts'),
  changed('MM', 'both-modified.ts'),
  changed('A.', 'added.ts'),
  changed('.A', 'intent-to-add.ts'),
  changed('D.', 'index-deleted.ts'),
  changed('.D', 'worktree-deleted.ts'),
  changed('.T', 'worktree-typechanged.ts'),
  changed('T.', 'index-typechanged.ts'),
  renamed('R.', 'new.ts', 'old.ts'),
  renamed('C.', 'copy.ts', 'source.ts'),
  conflicted('both.ts'),
  '? untracked-1.ts',
  '? untracked-2.ts',
  '',
].join('\n')

test('porcelain counts fall into status categories', () => {
  assert.deepEqual(readGit({ exitCode: 0, stdout: PORCELAIN }).status, {
    conflicted: 1,
    stashed: 4,
    deleted: 2,
    renamed: 1,
    modified: 3,
    staged: 7,
    untracked: 2,
    ahead: 2,
    behind: 3,
  })
})

test('branch without upstream has no ahead or behind counts', () => {
  const { status } = readGit({ exitCode: 0, stdout: `# branch.oid ${HASH}\n# branch.head topic/x\n` })

  assert.equal(status?.ahead, undefined)
  assert.equal(status?.behind, undefined)
  assert.equal(status?.stashed, 0)
})

test('branch comes from status header, and none when detached', () => {
  assert.equal(readGit({ exitCode: 0, stdout: PORCELAIN }).branch, 'main')
  assert.equal(readGit({ exitCode: 0, stdout: `# branch.oid ${HASH}\n# branch.head (detached)\n` }).branch, null)
})

test('nothing is known when git fails', () => {
  assert.deepEqual(readGit({ exitCode: NOT_A_REPO, stdout: '' }), { branch: null, status: null })
  assert.equal(readGit({ exitCode: 0, stdout: '# branch.ab +0 -0\n' }).status?.ahead, 0)
})
