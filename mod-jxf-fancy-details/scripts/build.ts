import { parseArgs } from 'node:util'

import { buildVariant, VARIANTS } from './variants.ts'

const USAGE = `usage: node scripts/build.ts --harness <${VARIANTS.map(({ harness }) => harness).join('|')}> --out <dir> --version <x.y.t>`

const { values } = parseArgs({
  options: { harness: { type: 'string' }, out: { type: 'string' }, version: { type: 'string' } },
})
const variant = VARIANTS.find(({ harness }) => harness === values.harness)
if (!variant || !values.out || !values.version) throw new Error(USAGE)

await buildVariant(variant, values.out, values.version)
