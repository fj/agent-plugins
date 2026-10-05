import { homedir } from 'node:os'
import { join } from 'node:path'

import { getAgentDir, ToolExecutionComponent } from '@earendil-works/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui'

import { fsDailyStore } from './fs-daily-store.ts'
import { CONFIG_FILE } from './config.ts'
import { modJxfFancyDetails } from './extension.ts'

const home = homedir()

export default modJxfFancyDetails({
  measure: { visibleWidth, truncateToWidth },
  store: fsDailyStore(home),
  home,
  configPath: join(getAgentDir(), CONFIG_FILE),
  toolRows: ToolExecutionComponent.prototype,
})
