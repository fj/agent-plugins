import type { SubscriptionStrategy } from './strategy.ts'

export const nullSubscriptionStrategy: SubscriptionStrategy = {
  name: 'null',
  read: () => null,
  render: () => [],
}
