export const SHOW_BRANCH = ['git', 'branch', '--show-current']

type GitOutput = { exitCode: number; stdout: string }

export function branchFrom({ exitCode, stdout }: GitOutput): string | null {
  const branch = stdout.trim()

  return exitCode === 0 && branch !== '' ? branch : null
}
