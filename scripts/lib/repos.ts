import type { Harness } from './harness.ts'

export const DEFAULT_OWNER = 'fj'
export const SOURCE_REPO = 'agent-plugins'
export const INDEX_REPO = 'jxf-agent-plugins-index'

export const releaseRepo = (plugin: string, harness: Harness) => `jxf-agent-plugins-${plugin}-${harness}`
export const submodulePath = (plugin: string, harness: Harness) => `${plugin}-${harness}`
export const releaseTag = (version: string) => `v${version}`
export const githubRemoteBase = (owner: string) => `git@github.com:${owner}`
export const remoteUrl = (base: string, repo: string) => `${base}/${repo}.git`
export const piGitRepo = (owner: string, plugin: string) => `github.com/${owner}/${releaseRepo(plugin, 'pi')}`
export const piGitSource = (owner: string, plugin: string, version: string) =>
  `git:${piGitRepo(owner, plugin)}@${releaseTag(version)}`
