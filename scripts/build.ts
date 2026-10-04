import { join } from 'node:path'

import { ROOT } from './root-manifest.ts'
import { buildVariant, VARIANTS } from './variants.ts'

for (const variant of VARIANTS) await buildVariant(variant, join(ROOT, 'dist', variant.name))
