import type { BoxProps, ElementConstructor, RenderNode, TextProps } from 'claude-code'

import { roleBackground, roleColor } from '../../render/pulse.ts'
import type { Line, Segment } from '../../render/segment.ts'

export type TextTag = ElementConstructor<TextProps>

export type BoxTag = ElementConstructor<BoxProps>

export function partNode(Text: TextTag, part: Segment, nowMs?: number): RenderNode {
  const color = roleColor(part.role, nowMs)
  const backgroundColor = roleBackground(part.role, nowMs)

  return (
    <Text {...(color === undefined ? {} : { color })} {...(backgroundColor === undefined ? {} : { backgroundColor })}>
      {part.text}
    </Text>
  )
}

export function lineNodes(Text: TextTag, line: Line): RenderNode[] {
  return line.map(part => partNode(Text, part))
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
