import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderInput, RenderNode } from 'claude-code'

import { localDayKey } from '../src/core/daily.ts'
import { EMPTY_LEDGER, markStep } from '../src/core/ledger.ts'
import { EMPTY_ROWS, markIds, promptIds, resolveRow } from '../src/core/rows.ts'
import { ZERO_TOTALS } from '../src/core/totals.ts'
import { footerLine } from '../src/render/footer.ts'
import { DONE_TIMER_COLOR, PALETTE } from '../src/render/palette.ts'
import { messagePrefix, turnLabel } from '../src/render/prefix.ts'
import { timerView } from '../src/render/timer.ts'
import type { Config } from './config.ts'
import { lineNodes } from './draw.tsx'
import { isUserOrigin } from './origin.ts'
import type { TimerProps } from './timer.tsx'

const ledgerAtom = atom({ plugin: 'mod-jxf-fancy', key: 'ledger' } as const, EMPTY_LEDGER)
const rowsAtom = atom({ plugin: 'mod-jxf-fancy', key: 'rows' } as const, EMPTY_ROWS)
const todayAtom = atom({ plugin: 'mod-jxf-fancy', key: 'today' } as const, { day: '', totals: ZERO_TOTALS })
const rateLimitsAtom = atom({ plugin: 'mod-jxf-fancy', key: 'rateLimits' } as const, [])

const MAX_PATH_WIDTH = 32
const MODE_SEPARATOR = ' & '

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

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!e.props.isFirstOfReply) {
      return next(e)
    }

    const ledger = await read($, ledgerAtom)
    const rows = await read($, rowsAtom)
    const id = resolveRow(rows, e.requestId, e.props.text, markIds(ledger, 'message'))
    const mark = id === undefined ? undefined : ledger.marks[id]

    if (mark === undefined) {
      reportMiss($, e, config.isDebug)

      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const prefix = messagePrefix({
      mark,
      step: markStep(ledger, mark.id),
      now: await $.clock.now(),
      usage: config.usage,
    })

    return (
      <Box flexDirection="column">
        <Text>{lineNodes(Text, prefix)}</Text>
        {await next(e)}
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

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const ledger = await read($, ledgerAtom)
    const today = await read($, todayAtom)
    const rateLimits = await read($, rateLimitsAtom)
    const windows = config.subscription.read({ windows: rateLimits })
    const day = localDayKey(await $.clock.now())
    const line = footerLine({
      model: await $.session.model(),
      cwd: await $.session.cwd(),
      home: (await $.env.get('HOME')) ?? '',
      session: ledger.totals,
      today: today.day === day ? today.totals : ZERO_TOTALS,
      quota: windows === null ? [] : config.subscription.render(windows),
      usage: config.usage,
      maxPathWidth: MAX_PATH_WIDTH,
    })
    const { Box, Text } = $.ui.resolve(e)
    const modes = e.props.modes.length > 0 ? `${e.props.modes.join(MODE_SEPARATOR)}  ` : ''

    return (
      <Box>
        {modes !== '' && <Text dimColor>{modes}</Text>}
        <Text wrap="truncate">{lineNodes(Text, line)}</Text>
      </Box>
    )
  })

}
