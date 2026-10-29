export type LatestRun = <T>(task: Promise<T>, apply: (value: T) => void | Promise<void>) => Promise<void>

export function latestRun(): LatestRun {
  let latest = 0

  return async (task, apply) => {
    const run = ++latest
    const value = await task

    if (run === latest) {
      await apply(value)
    }
  }
}
