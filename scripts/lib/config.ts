import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

import type { Harness } from './harness.ts'
import { DEFAULT_OWNER, INDEX_REPO, githubRemoteBase } from './repos.ts'

export const ROOT = resolve(import.meta.dirname, '..', '..')

const INDEX_ENV = 'JXF_AGENT_PLUGINS_INDEX'
const DATA_SUBDIR = 'jxf-agent-plugins'

export type Settings = { root: string; owner: string; remoteBase: string; indexDir: string; dataDir: string }

export function settings(env: NodeJS.ProcessEnv = process.env, root = ROOT): Settings {
  const owner = DEFAULT_OWNER
  return {
    root,
    owner,
    remoteBase: githubRemoteBase(owner),
    indexDir: resolve(env[INDEX_ENV] || join(root, '..', INDEX_REPO)),
    dataDir: join(env.XDG_DATA_HOME || join(homedir(), '.local', 'share'), DATA_SUBDIR),
  }
}

export const deployDir = (dataDir: string, harness: Harness, plugin: string) => join(dataDir, harness, plugin)
