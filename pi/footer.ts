import type { Totals } from '../src/core/totals.ts'
import { footerLine } from '../src/render/footer.ts'
import { PALETTE } from '../src/render/palette.ts'
import type { Line } from '../src/render/segment.ts'
import { alignRight, paint, paintLine } from './paint.ts'
import type { Scene } from './views.ts'

export type FooterScene = Scene & {
  model(): string
  cwd(): string
  home: string
  today(): Totals
  quota(): Line
}

export type FooterData = {
  getGitBranch(): string | null
  getExtensionStatuses(): ReadonlyMap<string, string>
}

const MIN_PATH_WIDTH = 16
const PATH_WIDTH_SHARE = 0.25
const CONTROL_CHARS = /[\r\n\t]+/g

function statusLine(data: FooterData): string | undefined {
  const statuses = [...data.getExtensionStatuses().values()].map(text => text.replace(CONTROL_CHARS, ' ').trim())
  const shown = statuses.filter(text => text !== '')

  return shown.length === 0 ? undefined : shown.join(' ')
}

export function footerLines(scene: FooterScene, data: FooterData, width: number): string[] {
  const line = footerLine({
    model: scene.model(),
    cwd: scene.cwd(),
    home: scene.home,
    session: scene.ledger().totals,
    today: scene.today(),
    quota: scene.quota(),
    usage: scene.usage(),
    maxPathWidth: Math.max(MIN_PATH_WIDTH, Math.floor(width * PATH_WIDTH_SHARE)),
  })
  const branch = data.getGitBranch()
  const left = branch === null ? '' : paint(`(${branch})`, PALETTE.muted)
  const statuses = statusLine(data)
  const main = alignRight(paintLine(line), width, scene.measure, left)

  return statuses === undefined ? [main] : [scene.measure.truncateToWidth(statuses, width), main]
}
