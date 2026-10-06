import type { QuotaMetadata, QuotaWindow } from '../../core/quota.ts'
import type { Line } from '../../render/segment.ts'

export interface SubscriptionStrategy {
  readonly name: string
  read(metadata: QuotaMetadata): readonly QuotaWindow[] | null
  render(windows: readonly QuotaWindow[]): Line
}
