import type { Totals } from '../../core/totals.ts'
import type { ContextFill } from '../../render/context.ts'
import { footer, type FooterLayout } from '../../render/footer.ts'
import { hasPulse } from '../../render/pulse.ts'
import type { Line } from '../../render/segment.ts'
import { besideRight } from './columns.ts'
import { paintLine } from './paint.ts'
import type { Scene } from './views.ts'

export type FooterScene = Scene & {
  model(): string
  effort(): string | undefined
  cwd(): string
  home: string
  today(): Totals
  quota(): Line
  context(): ContextFill | undefined
  cacheRemainingMs(): number | undefined
  layout(): FooterLayout
  showPulse(isPulsing: boolean): void
  showCountdown(isCounting: boolean): void
}

export type FooterData = {
  getGitBranch(): string | null
  getExtensionStatuses(): ReadonlyMap<string, string>
}

const MIN_PATH_WIDTH = 16
const PATH_WIDTH_SHARE = 0.25
const CONTROL_CHARS = /[\r\n\t]+/g
const STATUS_SEPARATOR = ' '

function statusText(data: FooterData): string {
  return [...data.getExtensionStatuses()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, text]) => text.replace(CONTROL_CHARS, ' ').trim())
    .filter(text => text !== '')
    .join(STATUS_SEPARATOR)
}

export function footerLines(scene: FooterScene, data: FooterData, width: number): string[] {
  const cacheRemainingMs = scene.cacheRemainingMs()
  const lines = footer({
    model: scene.model(),
    effort: scene.effort(),
    cwd: scene.cwd(),
    branch: data.getGitBranch() ?? undefined,
    home: scene.home,
    session: scene.ledger().totals,
    today: scene.today(),
    quota: scene.quota(),
    context: scene.context(),
    cacheRemainingMs,
    usage: scene.usage(),
    display: scene.display(),
    maxPathWidth: Math.max(MIN_PATH_WIDTH, Math.floor(width * PATH_WIDTH_SHARE)),
    layout: scene.layout(),
  })
  scene.showPulse(lines.some(hasPulse))
  scene.showCountdown((cacheRemainingMs ?? 0) > 0)
  const now = scene.now()

  return besideRight(statusText(data), lines.map(line => paintLine(line, now)), width, scene.measure)
}
