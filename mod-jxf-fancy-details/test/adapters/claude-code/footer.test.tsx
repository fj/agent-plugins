import { expect, test } from 'claude-code/testing'
import type { Engine, Mounted } from 'claude-code/testing'

import { PALETTE } from '../../../src/render/palette.ts'
import {
  CWD,
  dayDirOf,
  LIVE_SURFACES,
  MODEL,
  MODEL_LABEL,
  runTool,
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
      `${MODEL_LABEL} · ~/src/projects/fancy`,
      'session $0.00 ↑(Δ0 + ⟲ 0)/0 ↓0',
      'today 1m 00s · $1.25 ↑(Δ1.0k + ⟲ 0)/1.0k ↓1.0k',
      'ctx ▕        ▏ 0 / 200.0k',
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
  expect(text).toStartWith(MODEL_LABEL)
  expect(text).toContain('session 4.0s · $0.01 ↑(Δ1.2k + ⟲ 5.0k)/6.2k ↓300')
  expect(text).toContain('today 1m 04s · $1.26 ↑(Δ2.2k + ⟲ 5.0k)/7.2k ↓1.3k')
})

test('the context meter fills from the last step until the engine measures the context', async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0)

  expect(await footerText($)).toEndWith('ctx ▕▎       ▏ 6.2k / 200.0k')

  await $.session.measure({ context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [], changed: ['context'] })
  expect(await footerText($)).toEndWith('ctx ▕██      ▏ 50.0k / 200.0k')
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
    expect(rows.at(-1)).toEndWith('42%  ctx ▕        ▏ 0 / 200.0k')
    await ui.unmount()
  }
})

test('the footer shows no meters off a subscription', async ($, on) => {
  world(on)
  await start($)
  await measure($, [])

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(shownText(await ui.drawn())).not.toContain('5h')
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

test('subagent steps add their tokens and cost to the session and today', async ($, on) => {
  const w = world(on, { files: FILES })
  await start($)
  await submit($, 'go')
  w.scripts.push(textReply('agent work'))
  for await (const _chunk of $.turn.step({ turnId: 'turn-a', index: 0, model: MODEL, messageCount: 1, agentId: 'agent-1' })) {
    void _chunk
  }

  const text = await footerText($)
  expect(text).toContain('session $0.01 ↑(Δ1.2k + ⟲ 5.0k)/6.2k ↓300')
  expect(text).toContain('today 1m 00s · $1.26 ↑(Δ2.2k + ⟲ 5.0k)/7.2k ↓1.3k')
  const own = JSON.parse(w.files.get(`${TODAY_DIR}/claude-code-${SESSION_ID}.json`) ?? '{}')
  expect(own.usage.output).toBe(300)
})

test('a subagent step without usage adds nothing', async ($, on) => {
  const w = world(on)
  await submit($, 'go')
  w.scripts.push(textReply('agent work', null))
  for await (const _chunk of $.turn.step({ turnId: 'turn-a', index: 0, model: MODEL, messageCount: 1, agentId: 'agent-1' })) {
    void _chunk
  }

  expect(await footerText($)).toContain('session $0.00 ↑(Δ0 + ⟲ 0)/0 ↓0')
  expect(w.files.has(`${TODAY_DIR}/claude-code-${SESSION_ID}.json`)).toBe(false)
})

test('subagent turns add no active time to the session', async ($, on) => {
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

  expect(await footerText($)).toContain('session $0.00 ↑(Δ0 + ⟲ 0)/0 ↓0')
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
  expect(text).toContain('session 4.0s · $0.01 ↑(Δ1.2k + ⟲ 5.0k)/6.2k ↓300')
  expect(text).toContain('today 1m 04s · $1.26 ↑(Δ2.2k + ⟲ 5.0k)/7.2k ↓1.3k')
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
  expect(text).toContain('session 4.0s · $0.01 ↑(Δ1.2k + ⟲ 5.0k)/6.2k ↓300')
  expect(text).toContain('today 4.0s · $0.00 ↑(Δ0 + ⟲ 0)/0 ↓0')
})

test('the footer fills the context meter once the session measures it', async ($, on) => {
  world(on)
  await start($)
  await $.session.measure({ context: { tokens: 50_000, window: 200_000, percent: 25 }, rateLimits: [], changed: ['context'] })

  expect(await footerText($)).toEndWith('ctx ▕██      ▏ 50.0k / 200.0k')
})

test(
  'the footer options put the totals on one line, hide the meters and drop cached input',
  { options: { combineTotals: true, showSubscription: false, showContext: false, showCachedInput: false } },
  async ($, on) => {
    world(on)
    await start($)
    await measure($, [FIVE_HOUR])

    const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
    expect(shownRows(await ui.drawn())).toEqual([`${MODEL_LABEL} · ~/src/projects/fancy`, 'session $0.00 ↑0 ↓0  today $0.00 ↑0 ↓0'])
  },
)

const BRANCH_GLYPH = ''

test('the footer head shows the git branch of the session directory after the path', async ($, on) => {
  const w = world(on, { branch: 'main' })
  await start($)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(shownRows(await ui.drawn())[0]).toBe(`${MODEL_LABEL} · ~/src/projects/fancy · ${BRANCH_GLYPH} main`)
  expect(w.gitCwds).toEqual([CWD])
})

test('the footer head leaves out the branch outside a git repository', async ($, on) => {
  world(on)
  await start($)

  expect(await footerText($)).not.toContain(BRANCH_GLYPH)
})

test('the footer branch follows a checkout by a tool call and one made outside the session', async ($, on) => {
  const w = world(on, { branch: 'main' })
  await start($)

  w.branch = 'topic/x'
  await runTool($, w)
  expect(await footerText($)).toContain(`${BRANCH_GLYPH} topic/x`)

  w.branch = 'topic/y'
  await w.clock.advance(POLL_MS)
  expect(await footerText($)).toContain(`${BRANCH_GLYPH} topic/y`)
})

async function footerRows($: Engine): Promise<string[]> {
  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  const rows = shownRows(await ui.drawn())
  await ui.unmount()

  return rows
}

test('the footer head names an API key login', async ($, on) => {
  world(on, { credential: { handle: 'handle-1', kind: 'api-key' } })
  await start($)

  expect((await footerRows($))[0]).toStartWith(`anthropic/api/${MODEL} · `)
})

test('the footer head shows the effort of the last step after the model', async ($, on) => {
  const w = world(on)
  await start($)
  expect((await footerRows($))[0]).toStartWith(`${MODEL_LABEL} · `)

  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0, { effort: 'high' })
  expect((await footerRows($))[0]).toStartWith(`${MODEL_LABEL} (high) · `)

  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 1, { effort: 8000 })
  expect((await footerRows($))[0]).toStartWith(`${MODEL_LABEL} (8.0k) · `)

  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 2)
  expect((await footerRows($))[0]).toStartWith(`${MODEL_LABEL} · `)
})

test('a subagent step leaves the footer effort alone', async ($, on) => {
  const w = world(on)
  await start($)
  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0, { effort: 'high' })

  w.scripts.push(textReply('done'))
  await step($, 'turn-a', 0, { effort: 'low', agentId: 'agent-1' })
  expect((await footerRows($))[0]).toStartWith(`${MODEL_LABEL} (high) · `)
})

const CLOUD_ENV = [
  ['CLAUDE_CODE_USE_BEDROCK', 'bedrock'],
  ['CLAUDE_CODE_USE_VERTEX', 'vertex'],
  ['CLAUDE_CODE_USE_FOUNDRY', 'azure'],
  ['CLAUDE_CODE_USE_ANTHROPIC_AWS', 'aws'],
  ['CLAUDE_CODE_USE_ANTHROPIC_GOOGLE_CLOUD', 'gcp'],
  ['CLAUDE_CODE_USE_MANTLE', 'mantle'],
  ['CLAUDE_CODE_USE_GATEWAY', 'gateway'],
] as const

for (const [name, provider] of CLOUD_ENV) {
  test(`the footer head names ${provider} when ${name} is on`, async ($, on) => {
    world(on, { env: { [name]: '1' }, credential: null })
    await start($)

    expect((await footerRows($))[0]).toStartWith(`${provider}/api/${MODEL} · `)
  })
}

const MINUTE_MS = 60_000

async function cachedTurn($: Engine, w: ReturnType<typeof world>): Promise<void> {
  await submit($, 'go')
  w.scripts.push(textReply('done'))
  await step($, 'turn-1', 0)
}

const sessionRow = async ($: Engine) => (await footerRows($))[1]

test('the session row counts down a subscriber cache after a step that used it', async ($, on) => {
  const w = world(on)
  await start($)
  expect(await sessionRow($)).not.toContain('⌛')

  await cachedTurn($, w)
  expect(await sessionRow($)).toEndWith('↓300 ⌛60m')

  await w.clock.advance(30 * MINUTE_MS)
  expect(await sessionRow($)).toEndWith('⌛30m')
})

test('an API key keeps the cache five minutes', async ($, on) => {
  const w = world(on, { credential: { handle: 'handle-1', kind: 'api-key' } })
  await start($)
  await cachedTurn($, w)

  expect(await sessionRow($)).toEndWith('⌛5m')
})

test('the cache TTL setting overrides the default for a cloud provider', async ($, on) => {
  const w = world(on, { env: { CLAUDE_CODE_USE_FOUNDRY: '1' }, credential: null, settings: { promptCacheTtl: '1h' } })
  await start($)
  await cachedTurn($, w)

  expect(await sessionRow($)).toEndWith('⌛60m')
})

test('the cache TTL variable overrides the cache TTL setting', async ($, on) => {
  const w = world(on, { env: { CLAUDE_CODE_PROMPT_CACHE_TTL: '5m' }, settings: { promptCacheTtl: '1h' } })
  await start($)
  await cachedTurn($, w)

  expect(await sessionRow($)).toEndWith('⌛5m')
})

test('Bedrock keeps the cache an hour when its enable-1h variable is on', async ($, on) => {
  const env = { CLAUDE_CODE_USE_BEDROCK: '1', ENABLE_PROMPT_CACHING_1H_BEDROCK: '1' }
  const w = world(on, { env, credential: null })
  await start($)
  await cachedTurn($, w)

  expect(await sessionRow($)).toEndWith('⌛60m')
})

test('the session row leaves out the cache with prompt caching off', async ($, on) => {
  const w = world(on, { env: { DISABLE_PROMPT_CACHING: '1' } })
  await start($)
  await cachedTurn($, w)

  expect(await sessionRow($)).not.toContain('⌛')
})

const FULL_FIVE_HOUR = [
  { kind: 'five_hour', percentUsed: 100 },
  { kind: 'seven_day', percentUsed: 42 },
]
const FRAME_MS = 100
const OVERAGE_MARK = /^ \(!\)$/

async function pulseKey(ui: Pick<Mounted, 'find'>) {
  return (await ui.find({ type: 'Client' }))?.key
}

test('the meter row pulses a mark beside the full window while extra usage is on', async ($, on) => {
  world(on)
  await start($)
  await measure($, FULL_FIVE_HOUR)

  for (const surface of LIVE_SURFACES) {
    const ui = await $.ui.mount({ plugin: PLUGIN, surface, component: 'SessionMode', props: { modes: [] } })
    const key = await pulseKey(ui)
    expect(key).toBeDefined()

    const mark = async () => (await ui.find({ in: key, text: OVERAGE_MARK }))?.props.color
    const before = await mark()
    expect(before).toBeDefined()

    await ui.advance(FRAME_MS * 3)
    expect(await mark()).not.toBe(before)
    await ui.unmount()
  }
})

test('the meter row draws a steady mark on a surface that cannot animate', async ($, on) => {
  const w = world(on)
  await start($)
  await measure($, FULL_FIVE_HOUR)

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'vscode', component: 'SessionMode', props: { modes: [] } })
  const color = async () => (await ui.find({ text: OVERAGE_MARK }))?.props.color
  expect(await pulseKey(ui)).toBeUndefined()
  expect(await color()).toBe(PALETTE.overage)

  await w.clock.advance(FRAME_MS * 3)
  expect(await color()).toBe(PALETTE.overage)
  await ui.unmount()
})

test('the meter row has no mark or pulse while the plan serves the requests', async ($, on) => {
  world(on)
  await start($)
  await measure($, [FIVE_HOUR])

  const ui = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'SessionMode', props: { modes: [] } })
  expect(await pulseKey(ui)).toBeUndefined()
  expect(shownText(await ui.drawn())).not.toContain('(!)')
  await ui.unmount()
})

test('the meter row drops the mark once the plan serves the requests again', async ($, on) => {
  world(on)
  await start($)
  await measure($, FULL_FIVE_HOUR)
  await measure($, [FIVE_HOUR])

  expect(await footerText($)).not.toContain('(!)')
})

test('a subscriber cache drops to five minutes while extra usage is on, and back to an hour after', async ($, on) => {
  const w = world(on)
  await start($)
  await cachedTurn($, w)
  await measure($, FULL_FIVE_HOUR)

  expect(await sessionRow($)).toEndWith('⌛5m')

  await measure($, [FIVE_HOUR])
  expect(await sessionRow($)).toEndWith('⌛60m')
})
