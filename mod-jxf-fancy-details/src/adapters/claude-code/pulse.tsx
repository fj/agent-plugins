import type { ClientModule } from 'claude-code'

import { hasPulse } from '../../render/pulse.ts'
import type { Line } from '../../render/segment.ts'
import { partNode } from './draw.tsx'

const FRAME_MS = 100

export type PulseProps = { line: Line; epoch: string }

type PulseState = { epoch: string; tickedMs: number }

const PulsingLine: ClientModule<PulseProps, PulseState> = (props, surface) => {
  const { Text } = surface.elements
  const state = surface.state

  if (state === undefined) {
    surface.every(FRAME_MS, () => {
      const current = surface.state

      if (current !== undefined && hasPulse(props.line, current.tickedMs)) {
        surface.setState({ ...current, tickedMs: current.tickedMs + FRAME_MS })
      }
    })
  }

  const isSameEpoch = state?.epoch === props.epoch

  if (!isSameEpoch) {
    surface.setState({ epoch: props.epoch, tickedMs: 0 })
  }

  const now = isSameEpoch ? state.tickedMs : 0

  return (
    <Text wrap="truncate">{props.line.map(part => partNode(Text, part, now))}</Text>
  )
}

export default PulsingLine
