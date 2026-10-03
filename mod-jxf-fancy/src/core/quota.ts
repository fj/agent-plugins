export type QuotaWindow = { kind: string; percentUsed: number; resetsAt?: string }

export type QuotaMetadata = {
  windows?: readonly QuotaWindow[]
  headers?: Readonly<Record<string, string>>
}
