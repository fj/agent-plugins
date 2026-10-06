import type { Harness } from './harness.ts'
import { releaseAll, type ReleaseContext } from './release.ts'

export async function reportReleaseAll(ctx: ReleaseContext, harness: Harness): Promise<boolean> {
  const results = await releaseAll(ctx, harness)
  ctx.log(results.length ? '\nSummary:' : `No plugins support ${harness}.`)
  for (const result of results) {
    ctx.log(`  ${result.plugin}: ${'error' in result ? `FAILED: ${result.error}` : `${result.outcome} ${result.version}`}`)
  }
  return results.every((result) => !('error' in result))
}
