import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderInput, RenderNode } from 'claude-code'

import { EMPTY_LEDGER } from '../src/core/ledger.ts'
import { EMPTY_ROWS, promptIds, resolveRow } from '../src/core/rows.ts'
import { DONE_TIMER_COLOR, PALETTE } from '../src/render/palette.ts'
import { turnLabel } from '../src/render/prefix.ts'
import { timerView } from '../src/render/timer.ts'
import type { Config } from './config.ts'
import { isUserOrigin } from './origin.ts'
import type { TimerProps } from './timer.tsx'

const ledgerAtom = atom({ plugin: 'mod-jxf-fancy', key: 'ledger' } as const, EMPTY_LEDGER)
const rowsAtom = atom({ plugin: 'mod-jxf-fancy', key: 'rows' } as const, EMPTY_ROWS)

type Timing = { key: string; startedAt: number; endedAt?: number }

async function timerNode($: EngineInterface, e: RenderInput, { key, startedAt, endedAt }: Timing): Promise<RenderNode> {
  const { Text } = $.ui.resolve(e)
  const now = await $.clock.now()

  if (endedAt !== undefined) {
    return <Text color={DONE_TIMER_COLOR}>{timerView(startedAt, now, endedAt).text}</Text>
  }

  if (e.surface === 'terminal' || e.surface === 'desktop') {
    const { Client } = $.ui.resolve(e)
    const props: TimerProps = { startedAt, drawnAt: now }

    return <Client key={key} module="./timer.tsx" props={props} />
  }

  return <Text color={PALETTE.time}>{timerView(startedAt, now).text}</Text>
}

const reported = new Set<string>()

function reportMiss($: EngineInterface, e: RenderInput, isDebug: boolean): void {
  if (isDebug && !reported.has(e.requestId)) {
    reported.add(e.requestId)
    $.ui.log(`mod-jxf-fancy: ${e.component} row ${e.requestId} matched nothing`)
  }
}

export function drawSites(on: On, config: Config): void {
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!isUserOrigin(e.props.origin)) {
      return next(e)
    }

    const ledger = await read($, ledgerAtom)
    const rows = await read($, rowsAtom)
    const id = resolveRow(rows, e.requestId, e.props.text, promptIds(ledger))
    const prompt = id === undefined ? undefined : ledger.prompts[id]
    const drawn = await next(e)

    if (prompt === undefined) {
      reportMiss($, e, config.isDebug)

      return drawn
    }

    const { Box } = $.ui.resolve(e)
    const timer = await timerNode($, e, {
      key: `prompt-timer-${prompt.id}`,
      startedAt: prompt.submittedAt,
      endedAt: prompt.firstReplyAt,
    })

    return (
      <Box flexDirection="column">
        {drawn}
        {timer}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => next({ ...e, props: { ...e.props, isExpanded: true } }))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const ledger = await read($, ledgerAtom)
    const mark = ledger.marks[e.props.tool_use_id]

    if (mark === undefined) {
      reportMiss($, e, config.isDebug)

      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const timer = await timerNode($, e, {
      key: `tool-timer-${mark.id}`,
      startedAt: mark.startedAt,
      endedAt: mark.endedAt,
    })

    return (
      <Box flexDirection="column">
        <Box>
          <Text color={PALETTE.label}>{`turn ${turnLabel(mark)} `}</Text>
          {timer}
        </Box>
        {await next(e)}
      </Box>
    )
  })

}
