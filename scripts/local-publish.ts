import { mkdir, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import { readRootManifest, ROOT } from './root-manifest.ts'
import { buildVariant, VARIANTS } from './variants.ts'

export const LOCAL_MARKETPLACE = 'mod-jxf-fancy-local'

const MARKETPLACE_MANIFEST = join('.claude-plugin', 'marketplace.json')
const PUBLISHED_PI_SOURCE = /^(npm|git|https?):/
const PI_SOURCE_LINE = /^ {2}\S/

export type Run = (command: string, args: string[]) => string

export function defaultTarget(env: NodeJS.ProcessEnv = process.env): string {
  return join(env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), 'mod-jxf-fancy')
}

export async function publishLocally(target: string, run: Run, root = ROOT): Promise<void> {
  const manifest = await readRootManifest(root)
  const plugin = manifest.name as string

  for (const variant of VARIANTS) await buildVariant(variant, join(target, variant.name), root)
  await writeMarketplace(target, manifest)
  installInClaudeCode(target, plugin, run)
  installInPi(join(target, 'pi'), plugin, run)
}

async function writeMarketplace(target: string, manifest: Record<string, unknown>): Promise<void> {
  const marketplace = {
    name: LOCAL_MARKETPLACE,
    owner: manifest.author,
    plugins: [{ name: manifest.name, source: './claude-code', description: manifest.description }],
  }

  await mkdir(dirname(join(target, MARKETPLACE_MANIFEST)), { recursive: true })
  await writeFile(join(target, MARKETPLACE_MANIFEST), `${JSON.stringify(marketplace, null, 2)}\n`)
}

function installInClaudeCode(target: string, plugin: string, run: Run): void {
  const local = `${plugin}@${LOCAL_MARKETPLACE}`
  const marketplaces: { name: string }[] = JSON.parse(run('claude', ['plugin', 'marketplace', 'list', '--json']))
  const plugins: { id: string }[] = JSON.parse(run('claude', ['plugin', 'list', '--json']))
  const installed = plugins.map(({ id }) => id).filter((id) => id.startsWith(`${plugin}@`))

  if (!marketplaces.some(({ name }) => name === LOCAL_MARKETPLACE)) run('claude', ['plugin', 'marketplace', 'add', target])
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
