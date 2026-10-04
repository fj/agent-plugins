import type { BoxProps, ElementConstructor, RenderNode, TextProps } from 'claude-code'

import { PALETTE } from '../../render/palette.ts'
import type { Line } from '../../render/segment.ts'

export type TextTag = ElementConstructor<TextProps>

export type BoxTag = ElementConstructor<BoxProps>

export function lineNodes(Text: TextTag, line: Line): RenderNode[] {
  return line.map(part => {
    const color = PALETTE[part.role]

    return color === undefined ? <Text>{part.text}</Text> : <Text color={color}>{part.text}</Text>
  })
}

export function blankLine(Text: TextTag): RenderNode {
  return <Text> </Text>
}

export function rightColumn(Box: BoxTag, Text: TextTag, lines: Line[], props: BoxProps = {}): RenderNode {
  return (
    <Box {...props} flexDirection="column" alignItems="flex-end">
      {lines.map(line => (
        <Text wrap="truncate">{lineNodes(Text, line)}</Text>
      ))}
    </Box>
  )
}
