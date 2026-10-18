export type QuotaWindow = { kind: string; percentUsed: number; resetsAt?: string }

export type QuotaReading = { windows: readonly QuotaWindow[]; isUsingOverage: boolean }

export type QuotaMetadata = {
  windows?: readonly QuotaWindow[]
  headers?: Readonly<Record<string, string>>
}
