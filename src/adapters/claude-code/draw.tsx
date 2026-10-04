import type { ElementConstructor, RenderNode, TextProps } from 'claude-code'

import { PALETTE } from '../../render/palette.ts'
import type { Line } from '../../render/segment.ts'

export type TextTag = ElementConstructor<TextProps>

export function lineNodes(Text: TextTag, line: Line): RenderNode[] {
  return line.map(part => {
    const color = PALETTE[part.role]

    return color === undefined ? <Text>{part.text}</Text> : <Text color={color}>{part.text}</Text>
  })
}

export function blankLine(Text: TextTag): RenderNode {
  return <Text> </Text>
}
