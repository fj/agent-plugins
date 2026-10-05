import { join } from 'node:path'

import { commitTime } from './git.ts'
import { readRootManifest, ROOT } from './root-manifest.ts'
import { buildVariant, VARIANTS } from './variants.ts'
import { stamped } from './version.ts'

export const MARKETPLACE = 'jxf'

const PUBLISHED_PI_SOURCE = /^(npm|git|https?):/
const PI_SOURCE_LINE = /^ {2}\S/

export type Run = (command: string, args: string[]) => string

export function defaultTarget(root = ROOT): string {
  return join(root, 'dist')
}

export async function publishLocally(target: string, run: Run, root = ROOT, time = commitTime(root)): Promise<string> {
  const manifest = await readRootManifest(root)
  const plugin = manifest.name as string
  const version = stamped(manifest.version as string, time)

  requireMarketplace(run)
  for (const variant of VARIANTS) await buildVariant(variant, join(target, variant.name), root, version)
  installInClaudeCode(plugin, run)
  installInPi(join(target, 'pi'), plugin, run)
  return version
}

function requireMarketplace(run: Run): void {
  const marketplaces: { name: string }[] = JSON.parse(run('claude', ['plugin', 'marketplace', 'list', '--json']))
  if (!marketplaces.some(({ name }) => name === MARKETPLACE)) {
    throw new Error(`register the ${MARKETPLACE} marketplace first: claude plugin marketplace add <agent-plugins checkout>`)
  }
}

function installInClaudeCode(plugin: string, run: Run): void {
  const local = `${plugin}@${MARKETPLACE}`
  const plugins: { id: string }[] = JSON.parse(run('claude', ['plugin', 'list', '--json']))
  const installed = plugins.map(({ id }) => id).filter((id) => id.startsWith(`${plugin}@`))

  for (const id of installed) if (id !== local) run('claude', ['plugin', 'uninstall', id, '--keep-data'])
  run('claude', ['plugin', installed.includes(local) ? 'update' : 'install', local])
}

function installInPi(dir: string, plugin: string, run: Run): void {
  const sources = run('pi', ['list', '--no-approve'])
    .split('\n')
    .filter((line) => PI_SOURCE_LINE.test(line))
    .map((line) => line.trim())

  for (const source of sources) {
    if (PUBLISHED_PI_SOURCE.test(source) && source.includes(plugin)) run('pi', ['remove', source])
  }
  run('pi', ['install', dir])
}
