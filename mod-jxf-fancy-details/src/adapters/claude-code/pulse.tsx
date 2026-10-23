import type { ClientModule } from 'claude-code'

import type { Line } from '../../render/segment.ts'
import { partNode } from './draw.tsx'

const FRAME_MS = 100

export type PulseProps = { line: Line }

type PulseState = { tickedMs: number }

const PulsingLine: ClientModule<PulseProps, PulseState> = (props, surface) => {
  const { Text } = surface.elements
  const state = surface.state

  if (state === undefined) {
    surface.setState({ tickedMs: 0 })
    surface.every(FRAME_MS, () => {
      const current = surface.state

      if (current !== undefined) {
        surface.setState({ tickedMs: current.tickedMs + FRAME_MS })
      }
    })
  }

  const now = state?.tickedMs ?? 0

  return (
    <Text wrap="truncate">{props.line.map(part => partNode(Text, part, now))}</Text>
  )
}

export default PulsingLine
