import type { BoxProps, ElementConstructor, RenderNode, TextProps } from 'claude-code'

import { roleColor } from '../../render/pulse.ts'
import type { Line } from '../../render/segment.ts'

export type TextTag = ElementConstructor<TextProps>

export type BoxTag = ElementConstructor<BoxProps>

export function lineNodes(Text: TextTag, line: Line): RenderNode[] {
  return line.map(part => {
    const color = roleColor(part.role)

    return color === undefined ? <Text>{part.text}</Text> : <Text color={color}>{part.text}</Text>
  })
}

export function blankLine(Text: TextTag): RenderNode {
  return <Text> </Text>
}

export type LiveLine = (line: Line, index: number) => RenderNode | undefined

export function rightColumn(Box: BoxTag, Text: TextTag, lines: Line[], props: BoxProps = {}, live?: LiveLine): RenderNode {
  return (
    <Box {...props} flexDirection="column" alignItems="flex-end">
      {lines.map((line, index) => live?.(line, index) ?? <Text wrap="truncate">{lineNodes(Text, line)}</Text>)}
    </Box>
  )
}
