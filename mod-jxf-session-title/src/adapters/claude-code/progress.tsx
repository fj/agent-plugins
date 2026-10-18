import type { ClientModule } from 'claude-code'

import { FRAME_MS, progressText, spinnerFrame } from '../../render/progress.ts'
import { SPINNER_COLOR, TITLE_COLOR } from './palette.ts'

export type ProgressProps = { modelLabel: string; startedAt: number; drawnAt: number }

type ProgressState = { drawnAt: number; tickedMs: number }

const Progress: ClientModule<ProgressProps, ProgressState> = (props, surface) => {
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

  const elapsed = props.drawnAt + (isFresh ? state.tickedMs : 0) - props.startedAt

  return (
    <Text wrap="truncate">
      <Text color={SPINNER_COLOR}>{spinnerFrame(elapsed)}</Text>
      <Text color={TITLE_COLOR}>{` ${progressText(props.modelLabel, elapsed)}`}</Text>
    </Text>
  )
}

export default Progress
