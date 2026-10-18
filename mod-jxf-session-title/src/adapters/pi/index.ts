import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { getAgentDir } from '@earendil-works/pi-coding-agent'
import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui'

import { CONFIG_FILE } from './config.ts'
import { modJxfSessionTitle } from './extension.ts'

export default modJxfSessionTitle({
  configPath: join(getAgentDir(), CONFIG_FILE),
  files: {
    read: path => readFile(path, 'utf8'),
    async write(path, text) {
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, text)
    },
  },
  fit: {
    truncate: (text, maxWidth) => truncateToWidth(text, maxWidth),
    width: visibleWidth,
  },
})
