import type { Run } from './run.ts'

export type Marketplace = { name: string; source: string; path?: string; repo?: string }
type InstalledPlugin = { id: string; scope: string }

const claude = (run: Run, args: string[]) => run('claude', ['plugin', ...args])

export function ensureMarketplace(run: Run, name: string, source: string, matches: (m: Marketplace) => boolean): void {
  const marketplaces = JSON.parse(claude(run, ['marketplace', 'list', '--json']) || '[]') as Marketplace[]
  const existing = marketplaces.find((marketplace) => marketplace.name === name)

  if (existing && matches(existing)) return void claude(run, ['marketplace', 'update', name])
  if (existing) claude(run, ['marketplace', 'remove', name])
  claude(run, ['marketplace', 'add', source])
}

export function switchPlugins(run: Run, plugins: string[], from: string, to: string): void {
  const installed = JSON.parse(claude(run, ['list', '--json']) || '[]') as InstalledPlugin[]
  const find = (id: string) => installed.find((plugin) => plugin.id === id)

  for (const plugin of plugins) {
    const old = find(`${plugin}@${from}`)
    if (old) claude(run, ['uninstall', old.id, '--keep-data', '--scope', old.scope])
    const id = `${plugin}@${to}`
    claude(run, [find(id) ? 'update' : 'install', id])
  }
}
