import type { ClientModule } from 'claude-code'

import { countCacheDown } from '../../render/countdown.ts'
import type { Line } from '../../render/segment.ts'
import { lineNodes } from './draw.tsx'

const TICK_MS = 1000

export type CountdownProps = { line: Line; remainingMs: number; drawnAt: number }

type CountdownState = { drawnAt: number; tickedMs: number }

const CountdownLine: ClientModule<CountdownProps, CountdownState> = (props, surface) => {
  const { Text } = surface.elements
  const state = surface.state

  if (state === undefined) {
    surface.every(TICK_MS, () => {
      const current = surface.state

      if (current !== undefined) {
        surface.setState({ ...current, tickedMs: current.tickedMs + TICK_MS })
      }
    })
  }

  const isFresh = state?.drawnAt === props.drawnAt

  if (!isFresh) {
    surface.setState({ drawnAt: props.drawnAt, tickedMs: 0 })
  }

  const remainingMs = props.remainingMs - (isFresh ? state.tickedMs : 0)

  return <Text wrap="truncate">{lineNodes(Text, countCacheDown(props.line, remainingMs))}</Text>
}

export default CountdownLine
