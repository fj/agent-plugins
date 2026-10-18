import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderInput, RenderNode } from 'claude-code'

import { progressText } from '../../render/progress.ts'
import { TITLE_COLOR } from './palette.ts'
import type { ProgressProps } from './progress.tsx'
import type { SessionTitleBand } from './state'

export const BAND_KEY = 'session-title'
export const PROGRESS_KEY = 'session-title-progress'

const bandAtom = atom({ plugin: 'mod-jxf-session-title', key: 'band' } as const, { kind: 'idle' })

type ShownBand = Exclude<SessionTitleBand, { kind: 'idle' }>

async function bandNode($: EngineInterface, e: RenderInput, band: ShownBand): Promise<RenderNode> {
  const { Text } = $.ui.resolve(e)

  if (band.kind === 'titled') {
    return (
      <Text color={TITLE_COLOR} wrap="truncate">
        {band.title}
      </Text>
    )
  }

  const now = await $.clock.now()

  if (e.surface === 'terminal' || e.surface === 'desktop') {
    const { Client } = $.ui.resolve(e)
    const props: ProgressProps = { modelLabel: band.modelLabel, startedAt: band.startedAt, drawnAt: now }

    return <Client key={PROGRESS_KEY} module="./progress.tsx" props={props} />
  }

  return (
    <Text color={TITLE_COLOR} wrap="truncate">
      {progressText(band.modelLabel, now - band.startedAt)}
    </Text>
  )
}

export function drawBand(on: On): void {
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const band = await read($, bandAtom)

    if (e.props.hasSurvey || band.kind === 'idle') {
      return next(e)
    }

    const { Box } = $.ui.resolve(e)
    const shown = await bandNode($, e, band)
    const drawn = await next(e)

    return (
      <Box key={BAND_KEY} width={e.props.bodyColumns} flexDirection="column">
        <Box>{drawn}</Box>
        <Box justifyContent="flex-end">{shown}</Box>
      </Box>
    )
  })
}
