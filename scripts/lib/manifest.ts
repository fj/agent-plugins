import { HARNESSES, isHarness, type Harness } from './harness.ts'
import { showAtHead, topLevelDirsAtHead, tryGit } from './git.ts'

export const MANIFEST = 'agent-plugin.json'

const MAJOR_MINOR = /^\d+\.\d+$/

export type Author = { name: string; email?: string; url?: string }

export type Manifest = {
  name: string
  description: string
  version: string
  author?: Author
  harnesses: Harness[]
  build?: string
  test?: string
}

export type Plugin = { path: string; manifest: Manifest }

export function validateManifest(value: unknown, dir: string): Manifest {
  const problems = manifestProblems(value, dir)
  if (problems.length) throw new Error(`${dir}/${MANIFEST} is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
  return value as Manifest
}

function manifestProblems(value: unknown, dir: string): string[] {
  if (!isRecord(value)) return ['it must be a JSON object']
  const { name, description, version, author, harnesses, build, test } = value
  const problems: string[] = []

  if (name !== dir) problems.push(`name must be "${dir}", the directory name; got ${JSON.stringify(name)}`)
  if (typeof description !== 'string' || !description) problems.push('description must be a non-empty string')
  if (typeof version !== 'string' || !MAJOR_MINOR.test(version)) {
    problems.push(`version must be major.minor, like "0.1"; got ${JSON.stringify(version)}`)
  }
  if (author !== undefined && !(isRecord(author) && typeof author.name === 'string')) {
    problems.push('author must be an object with a string name')
  }
  if (!Array.isArray(harnesses) || !harnesses.length || !harnesses.every(isHarness)) {
    problems.push(`harnesses must be a non-empty list of ${HARNESSES.join(', ')}; got ${JSON.stringify(harnesses)}`)
  }
  for (const [field, command] of Object.entries({ build, test })) {
    if (command !== undefined && (typeof command !== 'string' || !command)) problems.push(`${field} must be a non-empty string`)
  }
  return problems
}

export function discoverPlugins(root: string): Plugin[] {
  return topLevelDirsAtHead(root).flatMap((dir) => {
    if (tryGit(root, ['cat-file', '-e', `HEAD:${dir}/${MANIFEST}`]) === undefined) return []
    return [{ path: dir, manifest: validateManifest(parseJson(showAtHead(root, `${dir}/${MANIFEST}`), dir), dir) }]
  })
}

export function findPlugin(plugins: Plugin[], name: string): Plugin {
  const plugin = plugins.find(({ manifest }) => manifest.name === name)
  const known = plugins.map(({ manifest }) => manifest.name).join(', ') || 'none'
  if (!plugin) throw new Error(`no plugin named ${name}; plugins: ${known}`)
  return plugin
}

export function supporting(plugins: Plugin[], harness: Harness): Plugin[] {
  return plugins.filter(({ manifest }) => manifest.harnesses.includes(harness))
}

function parseJson(text: string, dir: string): unknown {
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new Error(`${dir}/${MANIFEST} is not valid JSON: ${(error as Error).message}`)
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
