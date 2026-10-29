import type { GitStatusConfig } from '../config/starship.ts'
import type { GitStatus } from '../core/git-status.ts'

type Node =
  | { kind: 'text'; text: string }
  | { kind: 'variable'; name: string }
  | { kind: 'group'; children: Node[] }
  | { kind: 'conditional'; children: Node[] }

type Parsed = { nodes: Node[]; end: number }

type Lookup = (name: string) => string

type Rendered = { text: string; hasValue: boolean }

const ALL_STATUS = '$conflicted$stashed$deleted$renamed$modified$typechanged$staged$untracked'
const COUNTED = ['conflicted', 'stashed', 'deleted', 'renamed', 'modified', 'typechanged', 'staged', 'untracked'] as const
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

const render = (format: string, lookup: Lookup) => renderNodes(parse(format, 0).nodes, lookup).text

const counts =
  (values: Readonly<Record<string, number>>): Lookup =>
  name =>
    values[name]?.toString() ?? ''

function aheadBehind(status: GitStatus, { symbols }: GitStatusConfig): string {
  const { ahead, behind } = status

  if (ahead === undefined || behind === undefined) {
    return ''
  }

  if (ahead > 0 && behind > 0) {
    return render(symbols.diverged, counts({ ahead_count: ahead, behind_count: behind }))
  }

  if (ahead > 0) {
    return render(symbols.ahead, counts({ count: ahead }))
  }

  return behind > 0 ? render(symbols.behind, counts({ count: behind })) : render(symbols.up_to_date, counts({}))
}

function statusLookup(status: GitStatus, config: GitStatusConfig): Lookup {
  const lookup: Lookup = name => {
    if (name === 'all_status') {
      return render(ALL_STATUS, lookup)
    }

    if (name === 'ahead_behind') {
      return aheadBehind(status, config)
    }

    const counted = COUNTED.find(key => key === name)

    return counted === undefined || status[counted] === 0 ? '' : render(config.symbols[counted], counts({ count: status[counted] }))
  }

  return lookup
}

export function gitStatusText(status: GitStatus, config: GitStatusConfig): string {
  return config.isDisabled ? '' : render(config.format, statusLookup(status, config)).trim()
}
