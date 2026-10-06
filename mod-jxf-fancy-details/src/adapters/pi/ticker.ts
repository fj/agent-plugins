export type Ticker = { start(): void; stop(): void; isRunning(): boolean }

export function ticker(intervalMs: number, tick: () => void): Ticker {
  let handle: ReturnType<typeof setInterval> | undefined

  return {
    start() {
      handle ??= setInterval(tick, intervalMs)
    },
    stop() {
      clearInterval(handle)
      handle = undefined
    },
    isRunning: () => handle !== undefined,
  }
}
