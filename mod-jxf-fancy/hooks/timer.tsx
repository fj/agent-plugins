import type { ClientModule } from 'claude-code'

import { shimmer } from '../src/render/shimmer.ts'
import { timerView } from '../src/render/timer.ts'

const FRAME_MS = 100

export type TimerProps = { startedAt: number; drawnAt: number }

type TimerState = { drawnAt: number; tickedMs: number }

const LiveTimer: ClientModule<TimerProps, TimerState> = (props, surface) => {
  const { Text } = surface.elements
  const state = surface.state

  if (state === undefined) {
    surface.every(FRAME_MS, () => {
      const current = surface.state

      if (current !== undefined) {
        surface.setState({ ...current, tickedMs: current.tickedMs + FRAME_MS })
      }
    })
  }

  const isFresh = state?.drawnAt === props.drawnAt

  if (!isFresh) {
    surface.setState({ drawnAt: props.drawnAt, tickedMs: 0 })
  }

  const now = props.drawnAt + (isFresh ? state.tickedMs : 0)
  const { text } = timerView(props.startedAt, now)

  return (
    <Text>
      {shimmer(text, now).map(({ char, color }) => (
        <Text color={color}>{char}</Text>
      ))}
    </Text>
  )
}

export default LiveTimer
