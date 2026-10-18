import { isEnvSet } from '../../core/env.ts'

export type CloudFlags = {
  bedrock?: string
  vertex?: string
  foundry?: string
  anthropicAws?: string
  anthropicGoogleCloud?: string
  mantle?: string
  gateway?: string
}

export type Billing = 'subscription' | 'api'

export type CredentialKind = 'bearer' | 'api-key'

const FIRST_PARTY = 'anthropic'

const CLOUDS: readonly (readonly [keyof CloudFlags, string])[] = [
  ['bedrock', 'bedrock'],
  ['vertex', 'vertex'],
  ['foundry', 'azure'],
  ['anthropicAws', 'aws'],
  ['anthropicGoogleCloud', 'gcp'],
  ['mantle', 'mantle'],
  ['gateway', 'gateway'],
]

export function claudeCodeProvider(flags: CloudFlags): string {
  return CLOUDS.find(([flag]) => isEnvSet(flags[flag]))?.[1] ?? FIRST_PARTY
}

export function claudeCodeBilling(provider: string, credential: CredentialKind | undefined): Billing {
  return provider === FIRST_PARTY && credential === 'bearer' ? 'subscription' : 'api'
}
