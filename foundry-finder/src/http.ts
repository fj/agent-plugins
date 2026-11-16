export const DEFAULT_TIMEOUT_MS = 10_000;

export interface FetchOptions {
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}
