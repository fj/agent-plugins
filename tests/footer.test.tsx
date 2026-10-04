import { expect, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import {
  CWD,
  dayDirOf,
  LIVE_SURFACES,
  MODEL,
  PLUGIN,
  SESSION_ID,
  shownColumn,
  shownRows,
  shownText,
  step,
  submit,
  T0,
  textReply,
  TODAY_DIR,
  world,
} from './world.tsx'

const PI_SESSION = {
  usage: { input: 1000, cacheRead: 0, cacheWrite: 0, output: 1000 },
  cost: { usd: 1.25, isLowerBound: false },
  activeMs: 60_000,
}
const FILES = { [`${TODAY_DIR}/pi-other.json`]: JSON.stringify(PI_SESSION) }
const TURN_MS = 4000
const FIVE_HOUR = { kind: 'five_hour', percentUsed: 42 }

async function start($: Engine): Promise<void> {
  await $.session.start({ cwd: CWD, surface: 'terminal', isInteractive: true })
}

async function measure($: Engine, rateLimits: { kind: string; percentUsed: number }[]): Promise<void> {
  await $.session.measure({ context: { window: 200_000 }, rateLimits, changed: ['rateLimits'] })
}

test('the footer shows model and path, session, and today on separate lines beside the engine modes', async ($, on) => {
  const w = world(on, { files: FILES })
  await start($)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'SessionMode', props: { modes: ['focus'] } })
    const drawn = await ui.drawn()
    expect(shownText(drawn)).toStartWith('focus  ')
    expect(shownRows(drawn)).toEqual([
      `${MODEL} · ~/src/projects/fancy`,
      'session $0.00 ↑0 ↓0',
      'today 1m 00s · $1.25 ↑1.0k ↓1.0k',
      'ctx 200.0k',
    ])
    await ui.unmount()
  }

  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0)
  await w.clock.advance(TURN_MS)
  await $.turn.complete({ turnId: 'turn-1', answer: 'done', durationMs: TURN_MS, isAborted: false, reason: 'answer' })

  const own = w.files.get(`${TODAY_DIR}/claude-code-${SESSION_ID}.json`)
  expect(own).toBeDefined()
  expect(JSON.parse(own ?? '{}').activeMs).toBe(TURN_MS)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  const text = shownText(await ui.drawn())
  expect(text).toStartWith(MODEL)
  expect(text).toContain('session 4.0s · $0.01 ↑6.2k ↓300')
  expect(text).toContain('today 1m 04s · $1.26 ↑7.2k ↓1.3k')
})

test('the footer lines align to the right', async ($, on) => {
  world(on)
  await start($)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'SessionMode', props: { modes: [] } })
    expect(shownColumn(await ui.drawn())?.props?.alignItems).toBe('flex-end')
    await ui.unmount()
  }
})

test('the footer shows subscription meters from the rate limits', async ($, on) => {
  world(on)
  await start($)
  await measure($, [FIVE_HOUR])

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'SessionMode', props: { modes: [] } })
    const rows = shownRows(await ui.drawn())
    expect(rows).toHaveLength(4)
    expect(rows.at(-1)).toStartWith('5h ▕')
    expect(rows.at(-1)).toEndWith('42%  ctx 200.0k')
    await ui.unmount()
  }
})

test('the footer shows no meters off a subscription', async ($, on) => {
  world(on)
  await start($)
  await measure($, [])

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(shownText(await ui.drawn())).not.toContain('▕')
})

test('the null subscription strategy draws no meters', { options: { subscriptionStrategy: 'null' } }, async ($, on) => {
  world(on)
  await start($)
  await measure($, [FIVE_HOUR])

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(shownText(await ui.drawn())).not.toContain('5h')
})

const POLL_MS = 30_000
const DAY_MS = 24 * 60 * 60 * 1000

async function footerText($: Engine): Promise<string> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  const text = shownText(await ui.drawn())
  await ui.unmount()

  return text
}

test('today picks up other sessions on the next poll', async ($, on) => {
  const w = world(on)
  await start($)
  expect(await footerText($)).toContain('today $0.00')

  w.files.set(`${TODAY_DIR}/pi-late.json`, JSON.stringify(PI_SESSION))
  await w.clock.advance(POLL_MS)

  expect(await footerText($)).toContain('today 1m 00s · $1.25')
})

test("today shows nothing once yesterday's totals are stale", async ($, on) => {
  const w = world(on, { files: FILES })
  await submit($, 'go')
  await w.clock.advance(TURN_MS)
  await $.turn.complete({ turnId: 'turn-1', answer: 'done', durationMs: TURN_MS, isAborted: false, reason: 'answer' })
  expect(await footerText($)).toContain('today 1m 04s · $1.25')

  await w.clock.advance(DAY_MS)

  expect(await footerText($)).toContain('today $0.00')
})

test('today skips files that are not session totals', async ($, on) => {
  world(on, {
    files: {
      ...FILES,
      [`${TODAY_DIR}/broken.json`]: '{ not json',
      [`${TODAY_DIR}/other-shape.json`]: '{"cost": 3}',
      [`${TODAY_DIR}/pi-other.json.tmp`]: JSON.stringify(PI_SESSION),
    },
  })
  await start($)

  expect(await footerText($)).toContain('today 1m 00s · $1.25')
})

test('a missing day folder starts today at zero', async ($, on) => {
  world(on)
  await start($)

  expect(await footerText($)).toContain('today $0.00')
})

test('subagent turns add nothing to the session', async ($, on) => {
  const w = world(on)
  await submit($, 'go')
  await w.clock.advance(TURN_MS)
  await $.turn.complete({
    turnId: 'turn-a',
    answer: 'done',
    durationMs: TURN_MS,
    isAborted: false,
    reason: 'answer',
    agentId: 'agent-1',
  })

  expect(await footerText($)).toContain('session $0.00 ↑0 ↓0')
  expect(w.files.has(`${TODAY_DIR}/claude-code-${SESSION_ID}.json`)).toBe(false)
})

test('the footer reads the rate limits the session already has at start', async ($, on) => {
  const w = world(on)
  w.rateLimits.push(FIVE_HOUR)
  await start($)

  expect(await footerText($)).toContain('5h ▕')
})

test('a measurement that leaves rate limits alone keeps the meters', async ($, on) => {
  world(on)
  await start($)
  await measure($, [FIVE_HOUR])
  await $.session.measure({ context: { window: 200_000 }, rateLimits: [], changed: ['context'] })

  expect(await footerText($)).toContain('5h ▕')
})

async function completeTurn($: Engine): Promise<void> {
  await $.turn.complete({ turnId: 'turn-1', answer: 'done', durationMs: TURN_MS, isAborted: false, reason: 'answer' })
}

test('a failed day-file write leaves the turn and the footer intact', async ($, on) => {
  const w = world(on, { files: FILES, isWriteFailing: true })
  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0)
  await w.clock.advance(TURN_MS)
  await completeTurn($)

  expect(w.files.has(`${TODAY_DIR}/claude-code-${SESSION_ID}.json`)).toBe(false)
  const text = await footerText($)
  expect(text).toContain('session 4.0s · $0.01 ↑6.2k ↓300')
  expect(text).toContain('today 1m 04s · $1.26 ↑7.2k ↓1.3k')
})

const BEFORE_MIDNIGHT = new Date(2026, 9, 3, 23, 59, 58).getTime()
const NEXT_DAY_DIR = dayDirOf('2026-10-04')

test('a turn across midnight splits its totals between the two day files', async ($, on) => {
  const w = world(on)
  await w.clock.advance(BEFORE_MIDNIGHT - T0)
  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0)
  await w.clock.advance(TURN_MS)
  await completeTurn($)

  const ownFile = `claude-code-${SESSION_ID}.json`
  const yesterday = JSON.parse(w.files.get(`${TODAY_DIR}/${ownFile}`) ?? '{}')
  const today = JSON.parse(w.files.get(`${NEXT_DAY_DIR}/${ownFile}`) ?? '{}')
  expect([yesterday.usage.output, yesterday.activeMs]).toEqual([300, 0])
  expect([today.usage.output, today.activeMs]).toEqual([0, TURN_MS])

  const text = await footerText($)
  expect(text).toContain('session 4.0s · $0.01 ↑6.2k ↓300')
  expect(text).toContain('today 4.0s · $0.00 ↑0 ↓0')
})

test('the footer fills the context meter once the session measures it', async ($, on) => {
  world(on)
  await start($)
  await $.session.measure({ context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [], changed: ['context'] })

  expect(await footerText($)).toEndWith('ctx ▕██      ▏ 50.0k / 200.0k')
})

test(
  'the footer options put the totals on one line and hide the meters',
  { options: { combineTotals: true, showSubscription: false, showContext: false } },
  async ($, on) => {
    world(on)
    await start($)
    await measure($, [FIVE_HOUR])

    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
    expect(shownRows(await ui.drawn())).toEqual([`${MODEL} · ~/src/projects/fancy`, 'session $0.00 ↑0 ↓0  today $0.00 ↑0 ↓0'])
  },
)
