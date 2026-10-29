type Node =
  | { kind: 'text'; text: string }
  | { kind: 'variable'; name: string }
  | { kind: 'group'; children: Node[] }
  | { kind: 'conditional'; children: Node[] }

type Parsed = { nodes: Node[]; end: number }

type Rendered = { text: string; hasValue: boolean }

export type Lookup = (name: string) => string

const VARIABLE = /^\$(?:\{(\w+)\}|(\w+))/
const NOTHING: Rendered = { text: '', hasValue: false }

function skipStyle(format: string, at: number): number {
  if (format[at] !== '(') {
    return at
  }

  const close = format.indexOf(')', at)

  return close === -1 ? format.length : close + 1
}

function parse(format: string, start: number, closer?: string): Parsed {
  const nodes: Node[] = []
  let at = start

  while (at < format.length && format[at] !== closer) {
    const char = format[at]!
    const variable = VARIABLE.exec(format.slice(at))

    if (char === '\\' && at + 1 < format.length) {
      nodes.push({ kind: 'text', text: format[at + 1]! })
      at += 2
    } else if (variable !== null) {
      nodes.push({ kind: 'variable', name: variable[1] ?? variable[2]! })
      at += variable[0].length
    } else if (char === '[') {
      const group = parse(format, at + 1, ']')
      nodes.push({ kind: 'group', children: group.nodes })
      at = skipStyle(format, group.end + 1)
    } else if (char === '(') {
      const conditional = parse(format, at + 1, ')')
      nodes.push({ kind: 'conditional', children: conditional.nodes })
      at = conditional.end + 1
    } else {
      nodes.push({ kind: 'text', text: char })
      at += 1
    }
  }

  return { nodes, end: at }
}

function renderNode(node: Node, lookup: Lookup): Rendered {
  if (node.kind === 'text') {
    return { text: node.text, hasValue: false }
  }

  if (node.kind === 'variable') {
    const text = lookup(node.name)

    return { text, hasValue: text !== '' }
  }

  const inner = renderNodes(node.children, lookup)

  return node.kind === 'conditional' && !inner.hasValue ? NOTHING : inner
}

function renderNodes(nodes: readonly Node[], lookup: Lookup): Rendered {
  return nodes
    .map(node => renderNode(node, lookup))
    .reduce((all, part) => ({ text: all.text + part.text, hasValue: all.hasValue || part.hasValue }), NOTHING)
}

export function renderFormat(format: string, lookup: Lookup): string {
  return renderNodes(parse(format, 0).nodes, lookup).text
}
