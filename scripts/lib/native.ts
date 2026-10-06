import { join } from 'node:path'

import type { Harness } from './harness.ts'
import { readJson } from './json.ts'

export const NATIVE_MANIFEST: Record<Harness, string> = {
  claude: join('.claude-plugin', 'plugin.json'),
  pi: 'package.json',
}

export const PI_PACKAGE_KEYWORD = 'pi-package'

type Fields = Record<string, unknown>

const HARNESS_PROBLEMS: Record<Harness, (fields: Fields) => string[]> = {
  claude: () => [],
  pi: ({ keywords, pi }) => [
    ...(Array.isArray(keywords) && keywords.includes(PI_PACKAGE_KEYWORD) ? [] : [`keywords must contain ${PI_PACKAGE_KEYWORD}`]),
    ...(typeof pi === 'object' && pi !== null ? [] : ['a pi field is required']),
  ],
}

export async function validateNativePackage(dir: string, harness: Harness, name: string, version: string): Promise<void> {
  const path = NATIVE_MANIFEST[harness]
  let fields: Fields
  try {
    fields = (await readJson(join(dir, path))) as Fields
  } catch (error) {
    throw new Error(`the ${harness} build has no readable ${path}: ${(error as Error).message}`)
  }
  const problems = [
    ...(fields.name === name ? [] : [`name must be ${name}; got ${JSON.stringify(fields.name)}`]),
    ...(fields.version === version ? [] : [`version must be ${version}; got ${JSON.stringify(fields.version)}`]),
    ...HARNESS_PROBLEMS[harness](fields),
  ]
  if (problems.length) throw new Error(`the ${harness} build's ${path} is invalid:\n${problems.map((p) => `  - ${p}`).join('\n')}`)
}
