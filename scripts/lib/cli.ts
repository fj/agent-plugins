import { parseArgs } from 'node:util'

export type Arguments = { positionals: string[]; dryRun: boolean }

export function parseCli(args: string[], { dryRun = false } = {}): Arguments {
  const { positionals, values } = parseArgs({
    args: args[0] === '--' ? args.slice(1) : args,
    allowPositionals: true,
    options: dryRun ? { 'dry-run': { type: 'boolean', default: false } } : {},
  })
  return { positionals, dryRun: Boolean(values['dry-run']) }
}

export async function main(action: () => Promise<boolean | void>): Promise<void> {
  try {
    if ((await action()) === false) process.exitCode = 1
  } catch (error) {
    console.error((error as Error).message)
    process.exitCode = 1
  }
}

export function usage(text: string): never {
  throw new Error(`usage: ${text}`)
}
