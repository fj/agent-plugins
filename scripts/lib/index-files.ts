import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { HARNESSES, HARNESS_NAMES, type Harness } from './harness.ts'
import { readJson, writeJson } from './json.ts'
import { MARKETPLACE_FILE, RELEASED_MARKETPLACE, marketplace } from './marketplace.ts'
import { INDEX_REPO, SOURCE_REPO, piGitSource, releaseTag } from './repos.ts'

export const RELEASES_FILE = 'releases.json'
export const README_FILE = 'README.md'

export type Release = { repo: string; version: string }
export type PluginReleases = { description: string } & Partial<Record<Harness, Release>>
export type Releases = Record<string, PluginReleases>

export async function readReleases(indexDir: string): Promise<Releases> {
  try {
    return (await readJson(join(indexDir, RELEASES_FILE))) as Releases
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {}
    throw error
  }
}

export function recordRelease(
  releases: Releases,
  plugin: string,
  description: string,
  harness: Harness,
  release: Release,
): Releases {
  const updated = { ...releases, [plugin]: { ...releases[plugin], description, [harness]: release } }
  return Object.fromEntries(Object.entries(updated).sort(([a], [b]) => a.localeCompare(b)))
}

export async function writeIndexFiles(indexDir: string, releases: Releases, owner: string): Promise<string[]> {
  await writeJson(join(indexDir, RELEASES_FILE), releases)
  await writeJson(join(indexDir, MARKETPLACE_FILE), releasedMarketplace(releases, owner))
  await writeFile(join(indexDir, README_FILE), indexReadme(releases, owner))
  return [RELEASES_FILE, MARKETPLACE_FILE, README_FILE]
}

export function releasedMarketplace(releases: Releases, owner: string) {
  const plugins = Object.entries(releases).flatMap(([name, { description, claude }]) =>
    claude
      ? [{ name, description, version: claude.version, source: { source: 'github', repo: claude.repo, ref: releaseTag(claude.version) } }]
      : [],
  )
  return marketplace(RELEASED_MARKETPLACE, `Plugins released from ${owner}/${SOURCE_REPO}.`, plugins)
}

export function indexReadme(releases: Releases, owner: string): string {
  const entries = Object.entries(releases)
  const rows = entries.map(
    ([name, plugin]) => `| ${name} | ${plugin.description} | ${HARNESSES.map((h) => plugin[h]?.version ?? '-').join(' | ')} |`,
  )
  const claude = entries.filter(([, plugin]) => plugin.claude)
  const pi = entries.flatMap(([name, plugin]) => (plugin.pi ? [piGitSource(owner, name, plugin.pi.version)] : []))

  return [
    `# ${INDEX_REPO}`,
    '',
    `Released builds of the plugins in [${owner}/${SOURCE_REPO}](https://github.com/${owner}/${SOURCE_REPO}). Each plugin has one write-only repo per harness, included here as a submodule. Do not edit these repos by hand.`,
    '',
    `| Plugin | Description | ${HARNESSES.map((h) => HARNESS_NAMES[h]).join(' | ')} |`,
    `|---|---|${HARNESSES.map(() => '---').join('|')}|`,
    ...rows,
    '',
    '## Install',
    '',
    `### ${HARNESS_NAMES.claude}`,
    '',
    '```sh',
    `claude plugin marketplace add ${owner}/${INDEX_REPO}`,
    ...claude.map(([name]) => `claude plugin install ${name}@${RELEASED_MARKETPLACE}`),
    '```',
    '',
    `### ${HARNESS_NAMES.pi}`,
    '',
    '```sh',
    ...pi.map((source) => `pi install ${source}`),
    '```',
    '',
  ].join('\n')
}
