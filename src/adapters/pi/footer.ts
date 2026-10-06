import type { Totals } from '../../core/totals.ts'
import type { ContextFill } from '../../render/context.ts'
import { footer, type FooterLayout } from '../../render/footer.ts'
import type { Line } from '../../render/segment.ts'
import { alignRight, paintLine } from './paint.ts'
import type { Scene } from './views.ts'

export type FooterScene = Scene & {
  model(): string
  cwd(): string
  home: string
  today(): Totals
  quota(): Line
  context(): ContextFill | undefined
  layout(): FooterLayout
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
  const lines = footer({
    model: scene.model(),
    cwd: scene.cwd(),
    branch: data.getGitBranch() ?? undefined,
    home: scene.home,
    session: scene.ledger().totals,
    today: scene.today(),
    quota: scene.quota(),
    context: scene.context(),
    usage: scene.usage(),
    display: scene.display(),
    maxPathWidth: Math.max(MIN_PATH_WIDTH, Math.floor(width * PATH_WIDTH_SHARE)),
    layout: scene.layout(),
  })
  const statuses = statusLine(data)
  const main = lines.map(line => alignRight(paintLine(line), width, scene.measure))

  return statuses === undefined ? main : [scene.measure.truncateToWidth(statuses, width), ...main]
}
