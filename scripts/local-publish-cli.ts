import { execFileSync } from 'node:child_process'

import { defaultTarget, publishLocally } from './local-publish.ts'

const QUERIES = new Set(['list'])

const target = defaultTarget()
await publishLocally(target, (command, args) => {
  if (!args.some((arg) => QUERIES.has(arg))) console.log(`$ ${command} ${args.join(' ')}`)
  return execFileSync(command, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
})

console.log(`published ${target} locally: run /reload-plugins in Claude Code and restart Pi`)
