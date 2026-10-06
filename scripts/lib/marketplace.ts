import { join } from 'node:path'

export const RELEASED_MARKETPLACE = 'jxf'
export const LOCAL_MARKETPLACE = 'jxf-local'
export const MARKETPLACE_FILE = join('.claude-plugin', 'marketplace.json')

const OWNER = { name: 'John Feminella' }

export type MarketplaceEntry = { name: string; description: string; version: string; source: unknown }

export function marketplace(name: string, description: string, plugins: MarketplaceEntry[]) {
  return { name, owner: OWNER, description, plugins }
}
