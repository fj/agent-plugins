import assert from 'node:assert/strict'
import { test } from 'node:test'

import { addToDay, localDayKey, parseTotals, sessionFile } from '../src/core/daily.ts'
import { ZERO_TOTALS } from '../src/core/totals.ts'
import { footer } from '../src/render/footer.ts'
import { formatDuration, formatTokens, formatUsd, shortenPath } from '../src/render/format.ts'
import { meterBar } from '../src/render/meter.ts'
import { messagePrefix } from '../src/render/prefix.ts'
import { lineText } from '../src/render/segment.ts'
import { rainbow } from '../src/render/shimmer.ts'
import { promptTimerView, timerView } from '../src/render/timer.ts'
import { defaultUsageStrategy } from '../src/strategies/usage/default.ts'

const T0 = new Date(2026, 9, 3, 4, 20, 37).getTime()
const CACHED = { showsCachedInput: true }

test('durations count tenths under a minute, then minutes and hours', () => {
  assert.equal(formatDuration(4149), '4.1s')
  assert.equal(formatDuration(72_000), '1m 12s')
  assert.equal(formatDuration(3_725_000), '1h 02m')
  assert.equal(formatDuration(-5), '0.0s')
})

test('tokens and dollars use compact units', () => {
  assert.equal(formatTokens(999), '999')
  assert.equal(formatTokens(15_400), '15.4k')
  assert.equal(formatTokens(1_250_000), '1.3M')
  assert.equal(formatUsd({ usd: 12.345, isLowerBound: false }), '$12.35')
})

test('long paths keep the head and tail around an ellipsis', () => {
  assert.equal(shortenPath('/home/j/src/a', '/home/j', 40), '~/src/a')
  assert.equal(shortenPath('/home/j/src/projects/jxf/mod-jxf-fancy-details', '/home/j', 24), '~/src/…/mod-jxf-fancy-details')
})

test('a live timer counts from the start; a stopped one shows its duration', () => {
  assert.deepEqual(timerView(T0, T0 + 4100), { text: '{2026-10-03 04:20:37 Δ 4.1s}', isLive: true })
  assert.deepEqual(timerView(T0, T0 + 99_000, T0 + 3500), { text: '{2026-10-03 04:20:37 Δ 3.5s}', isLive: false })
})

test('a prompt timer runs until the first reply, and stops without one once the turn is over', () => {
  const prompt = { id: 'p', turn: 1, submittedAt: T0 }

  assert.deepEqual(promptTimerView(prompt, true, T0 + 2300), { text: '{2026-10-03 04:20:37 Δ 2.3s}', isLive: true })
  assert.deepEqual(promptTimerView({ ...prompt, firstReplyAt: T0 + 900 }, false, T0 + 5000), {
    text: '{2026-10-03 04:20:37 Δ 0.9s}',
    isLive: false,
  })
  assert.deepEqual(promptTimerView(prompt, false, T0 + 5000), { text: '{2026-10-03 04:20:37}', isLive: false })
})

test('the rainbow moves with time and along the text', () => {
  assert.match(rainbow(0, 0), /^#[0-9a-f]{6}$/)
  assert.notEqual(rainbow(0, 0), rainbow(0, 1))
  assert.notEqual(rainbow(0, 0), rainbow(250, 0))
})

test('meters stay at a fixed width and clamp', () => {
  assert.equal(meterBar(0, 4), '▕    ▏')
  assert.equal(meterBar(100, 4), '▕████▏')
  assert.equal(meterBar(250, 4), '▕████▏')
  assert.equal(meterBar(50, 3), '▕█▌ ▏')
})

test('the message prefix shows timing, turn, tokens and cost', () => {
  const step = {
    id: 's',
    turn: 3,
    startedAt: T0,
    endedAt: T0 + 4100,
    model: 'claude-opus-5-5',
    usage: { input: 400, cacheWrite: 15_000, cacheRead: 61_100, output: 3_200 },
    cost: { usd: 0.06, isLowerBound: false },
    totals: {
      usage: { input: 1000, cacheWrite: 30_000, cacheRead: 60_800, output: 12_000 },
      cost: { usd: 12.34, isLowerBound: false },
      activeMs: 0,
    },
  }
  const mark = { id: 'm', kind: 'message' as const, turn: 3, seq: 2, startedAt: T0, stepId: 's' }

  assert.equal(
    lineText(messagePrefix({ mark, step, now: T0, usage: defaultUsageStrategy, display: CACHED })),
    '{2026-10-03 04:20:37 Δ 4.1s} {turn 3.2: ↑ ( Δ 15.4k + ⟲ 61.1k ) / Σ 91.8k · ↓ Δ 3.2k / Σ 12.0k} {Δ $0.06 / Σ $12.34}',
  )
})

test('a prefix without a finished step shows live timing and the turn only', () => {
  const mark = { id: 'm', kind: 'message' as const, turn: 1, seq: 1, startedAt: T0 }

  assert.equal(
    lineText(messagePrefix({ mark, now: T0 + 1500, usage: defaultUsageStrategy, display: CACHED })),
    '{2026-10-03 04:20:37 Δ 1.5s} {turn 1.1}',
  )
})

const QUOTA = [{ text: '5h 42%', role: 'meter' } as const]

const FOOTER_INPUT = {
  model: 'claude-opus-5-5',
  cwd: '/home/j/src/projects/jxf/mod-jxf-fancy-details',
  home: '/home/j',
  session: { ...ZERO_TOTALS, cost: { usd: 12.34, isLowerBound: false }, activeMs: 65_000 },
  today: { ...ZERO_TOTALS, cost: { usd: 48.1, isLowerBound: true }, activeMs: 3_725_000 },
  quota: [],
  usage: defaultUsageStrategy,
  display: { showsCachedInput: false },
  maxPathWidth: 24,
  layout: { isTotalsCombined: false, showsSubscription: true, showsContext: true },
}

test('the footer puts model and path, session, and today on their own lines', () => {
  assert.deepEqual(footer(FOOTER_INPUT).map(lineText), [
    'claude-opus-5-5 · ~/src/…/mod-jxf-fancy-details',
    'session 1m 05s · $12.34 ↑0 ↓0',
    'today 1h 02m · $48.10+ ↑0 ↓0',
  ])
})

test('the footer head shows the git branch after the path when there is one', () => {
  const [head] = footer({ ...FOOTER_INPUT, branch: 'topic/x' })

  assert.equal(lineText(head!), 'claude-opus-5-5 · ~/src/…/mod-jxf-fancy-details · \ue0a0 topic/x')
  assert.equal(head!.at(-1)?.role, 'branch')
})
test('the footer splits total input into new and cached input when asked', () => {
  const session = { ...ZERO_TOTALS, usage: { input: 400, cacheWrite: 15_000, cacheRead: 61_100, output: 3_200 } }
  const lines = footer({ ...FOOTER_INPUT, session, display: CACHED })

  assert.equal(lineText(lines[1]!), 'session $0.00 ↑(Δ15.4k + ⟲ 61.1k)/76.5k ↓3.2k')
})

test('the footer leaves out a time that shows as zero', () => {
  const lines = footer({ ...FOOTER_INPUT, session: ZERO_TOTALS, today: { ...ZERO_TOTALS, activeMs: 99 } })

  assert.deepEqual(lines.slice(1).map(lineText), ['session $0.00 ↑0 ↓0', 'today $0.00 ↑0 ↓0'])
})

test('the footer keeps the smallest time that shows as nonzero', () => {
  const lines = footer({ ...FOOTER_INPUT, session: { ...ZERO_TOTALS, activeMs: 100 } })

  assert.equal(lineText(lines[1]!), 'session 0.1s · $0.00 ↑0 ↓0')
})


test('the footer adds subscription usage as a last line', () => {
  const lines = footer({ ...FOOTER_INPUT, quota: [{ text: '5h 42%', role: 'meter' }] })

  assert.equal(lines.length, 4)
  assert.equal(lineText(lines[3]!), '5h 42%')
})
test('the footer can put session and today on one line', () => {
  const lines = footer({ ...FOOTER_INPUT, layout: { ...FOOTER_INPUT.layout, isTotalsCombined: true } })

  assert.deepEqual(lines.slice(1).map(lineText), ['session 1m 05s · $12.34 ↑0 ↓0  today 1h 02m · $48.10+ ↑0 ↓0'])
})

test('the footer shows the context fill and window beside the subscription meters', () => {
  const lines = footer({ ...FOOTER_INPUT, quota: QUOTA, context: { tokens: 50_000, window: 200_000 } })

  assert.equal(lineText(lines[3]!), '5h 42%  ctx ▕██      ▏ 50.0k / 200.0k')
})

test('the footer shows only the window size before the context fill is known', () => {
  const lines = footer({ ...FOOTER_INPUT, context: { window: 1_000_000 } })

  assert.equal(lineText(lines[3]!), 'ctx 1.0M')
})

test('the footer layout can hide the subscription meters, the context, or both', () => {
  const input = { ...FOOTER_INPUT, quota: QUOTA, context: { window: 200_000 } }
  const meters = (layout: Partial<typeof FOOTER_INPUT.layout>) =>
    footer({ ...input, layout: { ...input.layout, ...layout } }).slice(3).map(lineText)

  assert.deepEqual(meters({ showsSubscription: false }), ['ctx 200.0k'])
  assert.deepEqual(meters({ showsContext: false }), ['5h 42%'])
  assert.deepEqual(meters({ showsSubscription: false, showsContext: false }), [])
})


test('daily totals accumulate per local day and round-trip through JSON', () => {
  const day = localDayKey(T0)
  const delta = { ...ZERO_TOTALS, activeMs: 5 }
  const days = addToDay(addToDay({}, day, delta), day, delta)

  assert.equal(day, '2026-10-03')
  assert.equal(days[day]?.activeMs, 10)
  assert.deepEqual(parseTotals(JSON.stringify(days[day])), days[day])
  assert.equal(parseTotals('{"nope":1}'), null)
  assert.equal(parseTotals('not json'), null)
  assert.equal(sessionFile('/h', day, 'claude/a:b'), '/h/.local/state/mod-jxf-fancy-details/days/2026-10-03/claude_a_b.json')
})
