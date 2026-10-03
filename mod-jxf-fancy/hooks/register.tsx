import type { Register } from 'claude-code'

import { configFrom } from './config.ts'
import { trackEvents } from './events.ts'
import { drawSites } from './render.tsx'

export const register: Register = (on, options) => {
  const config = configFrom(options)

  trackEvents(on, config)
  drawSites(on, config)
}
