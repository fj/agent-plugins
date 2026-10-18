import type { Register } from 'claude-code'

import { configFrom } from './config.ts'
import { trackTitles } from './events.ts'
import { drawBand } from './render.tsx'

export const register: Register = (on, options) => {
  trackTitles(on, configFrom(options))
  drawBand(on)
}
