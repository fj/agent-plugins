export function publishArgs(dryRun: boolean): string[] {
  return ['publish', ...(dryRun ? ['--dry-run'] : [])]
}
