export type Role =
  | 'plain'
  | 'muted'
  | 'time'
  | 'label'
  | 'input'
  | 'cache'
  | 'output'
  | 'cost'
  | 'model'
  | 'path'
  | 'branch'
  | 'meter'

export type Segment = { text: string; role: Role }

export type Line = readonly Segment[]

export function seg(text: string, role: Role = 'plain'): Segment {
  return { text, role }
}

export function join(groups: readonly Line[], separator: Segment): Line {
  return groups.filter(group => group.length > 0).flatMap((group, i) => (i === 0 ? group : [separator, ...group]))
}

export function lineText(line: Line): string {
  return line.map(part => part.text).join('')
}
