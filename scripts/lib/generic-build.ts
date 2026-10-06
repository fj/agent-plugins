import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'

import type { Harness } from './harness.ts'
import { writeJson } from './json.ts'
import type { Manifest } from './manifest.ts'
import { NATIVE_MANIFEST, PI_PACKAGE_KEYWORD } from './native.ts'

const COMMANDS = 'commands'
const PROMPTS = 'prompts'
const MARKDOWN = '.md'
const REFERENCE = /\{\{command:([^}]*)\}\}/g

type Command = { source: string; segments: string[]; text: string }

type Layout = {
  file: (plugin: string, segments: string[]) => string
  invocation: (plugin: string, segments: string[]) => string
  manifest: (manifest: Manifest, version: string) => Record<string, unknown>
}

const shared = ({ name, description, author }: Manifest, version: string) => ({ name, version, description, author })

const LAYOUTS: Record<Harness, Layout> = {
  claude: {
    file: (_, segments) => join(COMMANDS, ...segments) + MARKDOWN,
    invocation: (plugin, segments) => `/${plugin}:${segments.join(':')}`,
    manifest: shared,
  },
  pi: {
    file: (plugin, segments) => join(PROMPTS, [plugin, ...segments].join('-') + MARKDOWN),
    invocation: (plugin, segments) => `/${[plugin, ...segments].join('-')}`,
    manifest: (manifest, version) => ({
      ...shared(manifest, version),
      keywords: [PI_PACKAGE_KEYWORD],
      pi: { prompts: [`./${PROMPTS}`] },
    }),
  },
}

export async function buildGeneric(source: string, manifest: Manifest, harness: Harness, out: string, version: string): Promise<void> {
  const layout = LAYOUTS[harness]
  const commands = await readCommands(source)
  const files = targetFiles(commands, (segments) => layout.file(manifest.name, segments))
  const known = new Map(commands.map(({ segments }) => [segments.join(':'), segments]))
  const problems: string[] = []

  for (const [file, command] of files) {
    const text = command.text.replace(REFERENCE, (reference, path: string) => {
      const segments = known.get(path)
      if (segments) return layout.invocation(manifest.name, segments)
      problems.push(`${command.source} refers to an unknown command: ${reference}`)
      return reference
    })
    await mkdir(dirname(join(out, file)), { recursive: true })
    await writeFile(join(out, file), text)
  }
  if (problems.length) throw new Error(problems.join('\n'))
  await writeJson(join(out, NATIVE_MANIFEST[harness]), layout.manifest(manifest, version))
}

async function readCommands(source: string): Promise<Command[]> {
  const root = join(source, COMMANDS)
  const entries = await readdir(root, { recursive: true }).catch(() => [])
  const paths = entries.filter((path) => path.endsWith(MARKDOWN)).sort()
  if (!paths.length) throw new Error(`no ${COMMANDS}/**/*${MARKDOWN} files to build from`)

  return Promise.all(
    paths.map(async (path) => ({
      source: join(COMMANDS, path),
      segments: path.slice(0, -MARKDOWN.length).split(sep),
      text: await readFile(join(root, path), 'utf8'),
    })),
  )
}

function targetFiles(commands: Command[], file: (segments: string[]) => string): Map<string, Command> {
  const files = new Map<string, Command>()
  for (const command of commands) {
    const target = file(command.segments)
    const other = files.get(target)
    if (other) throw new Error(`${other.source} and ${command.source} both become ${target}`)
    files.set(target, command)
  }
  return files
}
