import type { Run } from './run.ts'

export type RepoCreator = (repo: string, description: string) => void

export function githubRepoCreator(run: Run, owner: string): RepoCreator {
  let token: string | undefined
  return (repo, description) => {
    token ??= run('gh', ['auth', 'token', '--user', owner])
    run('gh', ['repo', 'create', `${owner}/${repo}`, '--public', '--description', description], {
      env: { ...process.env, GH_TOKEN: token },
    })
  }
}
