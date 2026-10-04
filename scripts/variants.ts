import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, sep } from 'node:path'

import { readJson, readRootManifest, ROOT } from './root-manifest.ts'

const ADAPTERS = join('src', 'adapters')
const TEMPLATE = 'manifest.json'
const DEV_ONLY = new Set([TEMPLATE, 'tsconfig.json'])
const SHARED_FIELDS = ['name', 'version', 'description', 'author']
const NPM_FIELDS = [...SHARED_FIELDS, 'repository']
const NPM_MANIFEST = 'package.json'

export type Variant = { name: string; package: string; manifest: string }

export const VARIANTS: Variant[] = [
  { name: 'claude-code', package: 'mod-jxf-fancy-claude-code', manifest: join('.claude-plugin', 'plugin.json') },
  { name: 'pi', package: 'mod-jxf-fancy-pi', manifest: NPM_MANIFEST },
]

export async function buildVariant(variant: Variant, out: string, root = ROOT, version?: string): Promise<void> {
  await rm(join(out, 'src'), { recursive: true, force: true })
  await cp(join(root, 'src'), join(out, 'src'), {
    recursive: true,
    filter: (path) => belongsTo(variant, relative(root, path)),
  })
  for (const [path, manifest] of await manifestsOf(variant, root, version)) {
    await mkdir(dirname(join(out, path)), { recursive: true })
    await writeFile(join(out, path), `${JSON.stringify(manifest, null, 2)}\n`)
  }
}

function belongsTo(variant: Variant, path: string): boolean {
  const adapter = join(ADAPTERS, variant.name)

  if (path.startsWith(ADAPTERS + sep) && path !== adapter && !path.startsWith(adapter + sep)) return false
  return !(dirname(path) === adapter && DEV_ONLY.has(basename(path)))
}

async function manifestsOf(variant: Variant, root: string, version?: string): Promise<Map<string, Record<string, unknown>>> {
  const shared = { ...(await readRootManifest(root)), ...(version && { version }) }
  const template = await readJson(join(root, ADAPTERS, variant.name, TEMPLATE))
  const manifests = new Map([[NPM_MANIFEST, { ...pick(shared, NPM_FIELDS), name: variant.package }]])

  manifests.set(variant.manifest, { ...(manifests.get(variant.manifest) ?? pick(shared, SHARED_FIELDS)), ...template })
  return manifests
}

function pick(source: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => field in source).map((field) => [field, source[field]]))
}
