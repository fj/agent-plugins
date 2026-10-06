import { atom, read } from 'claude-code'
import type { EngineInterface, On, RenderInput, RenderNode } from 'claude-code'

import { EMPTY_JOURNAL } from '../../core/journal.ts'
import { markStep } from '../../core/ledger.ts'
import { EMPTY_ROWS, markIds, promptIds, resolveRow } from '../../core/rows.ts'
import { NO_OTHER_SESSIONS, todayTotals } from '../../core/tracker.ts'
import { footerHead, footerRows, type FooterInput } from '../../render/footer.ts'
import { DONE_TIMER_COLOR, PALETTE } from '../../render/palette.ts'
import { messagePrefix, turnTag } from '../../render/prefix.ts'
import { seg } from '../../render/segment.ts'
import { timerView } from '../../render/timer.ts'
import type { Config } from './config.ts'
import { blankLine, lineNodes, rightColumn } from './draw.tsx'
import { isUserOrigin } from './origin.ts'
import type { TimerProps } from './timer.tsx'

const journalAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'journal' } as const, EMPTY_JOURNAL)
const othersAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'others' } as const, NO_OTHER_SESSIONS)
const rowsAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'rows' } as const, EMPTY_ROWS)
const rateLimitsAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'rateLimits' } as const, [])
const contextAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'context' } as const, null)
const branchAtom = atom({ plugin: 'mod-jxf-fancy-details', key: 'branch' } as const, null)

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
    $.ui.log(`${e.component} row ${e.requestId} matched nothing`)
  }
}

async function footerInput($: EngineInterface, config: Config): Promise<FooterInput> {
  const { ledger, days } = await read($, journalAtom)
  const others = await read($, othersAtom)
  const rateLimits = await read($, rateLimitsAtom)
  const context = await read($, contextAtom)
  const branch = await read($, branchAtom)
  const windows = config.subscription.read({ windows: rateLimits })

  return {
    model: await $.session.model(),
    cwd: await $.session.cwd(),
    branch: branch ?? undefined,
    home: (await $.env.get('HOME')) ?? '',
    session: ledger.totals,
    today: todayTotals(days, others, await $.clock.now()),
    quota: windows === null ? [] : config.subscription.render(windows),
    context: context ?? undefined,
    usage: config.usage,
    display: config.display,
    maxPathWidth: MAX_PATH_WIDTH,
    layout: config.footer,
  }
}

export function drawSites(on: On, config: Config): void {
  on('ui.render', { component: 'UserMessage' }, async ($, e, next) => {
    if (!isUserOrigin(e.props.origin)) {
      return next(e)
    }

    const { ledger } = await read($, journalAtom)
    const rows = await read($, rowsAtom)
    const id = resolveRow(rows, e.requestId, e.props.text, promptIds(ledger))
    const prompt = id === undefined ? undefined : ledger.prompts[id]
    const drawn = await next(e)

    if (prompt === undefined) {
      reportMiss($, e, config.isDebug)

      return drawn
    }

    const { Box, Text } = $.ui.resolve(e)
    const timer = await timerNode($, e, {
      key: `prompt-timer-${prompt.id}`,
      startedAt: prompt.submittedAt,
      endedAt: prompt.firstReplyAt,
    })

    return (
      <Box flexDirection="column">
        {drawn}
        {blankLine(Text)}
        {timer}
      </Box>
    )
  })

  on('ui.render', { component: 'AssistantMessage' }, async ($, e, next) => {
    if (!e.props.isFirstOfReply) {
      return next(e)
    }

    const { ledger } = await read($, journalAtom)
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
      display: config.display,
    })

    return (
      <Box flexDirection="column">
        {blankLine(Text)}
        <Text>{lineNodes(Text, prefix)}</Text>
        {await next(e)}
      </Box>
    )
  })

  on('ui.render', { component: 'ToolGroup' }, ($, e, next) => next({ ...e, props: { ...e.props, isExpanded: true } }))

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    const { ledger } = await read($, journalAtom)
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
        {blankLine(Text)}
        <Box>
          {timer}
          <Text>{lineNodes(Text, [seg(' '), ...turnTag(mark)])}</Text>
        </Box>
        {await next(e)}
      </Box>
    )
  })

  const isAbovePrompt = config.footerPlacement === 'abovePrompt'

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const input = await footerInput($, config)
    const { Box, Text } = $.ui.resolve(e)
    const modes = e.props.modes.length > 0 ? `${e.props.modes.join(MODE_SEPARATOR)}  ` : ''

    return (
      <Box>
        {modes !== '' && <Text dimColor>{modes}</Text>}
        {rightColumn(Box, Text, [footerHead(input), ...(isAbovePrompt ? [] : footerRows(input))])}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || !isAbovePrompt) {
      return next(e)
    }

    const { Box, Text } = $.ui.resolve(e)
    const rows = footerRows(await footerInput($, config))

    return rightColumn(Box, Text, rows, { key: 'footer-rows', width: e.props.bodyColumns })
  })
}
