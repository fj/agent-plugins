import type { QuotaMetadata, QuotaReading } from '../../core/quota.ts'
import type { Line } from '../../render/segment.ts'

export interface SubscriptionStrategy {
  readonly name: string
  read(metadata: QuotaMetadata): QuotaReading | null
  render(reading: QuotaReading): Line
}
