export type TomlValue = string | boolean

type Table = Record<string, TomlValue>

const MULTILINE_BASIC = '"""'
const MULTILINE_LITERAL = "'''"
const HEX = 16
const ESCAPES: Readonly<Record<string, string>> = { b: '\b', t: '\t', n: '\n', f: '\f', r: '\r', '"': '"', '\\': '\\' }
const UNICODE_ESCAPE = /^(?:u([0-9a-fA-F]{4})|U([0-9a-fA-F]{8}))/
const LINE_CONTINUATION = /^\\[ \t]*\r?\n\s*/
const LEADING_NEWLINE = /^\r?\n/
const KEY = /^\s*("[^"]*"|'[^']*'|[A-Za-z0-9_.-]+)\s*=\s*/
const HEADER = /^\s*\[\s*(.*?)\s*\]\s*(#.*)?$/

const unquote = (key: string) => (key.startsWith('"') || key.startsWith("'") ? key.slice(1, -1) : key)

function unescape(raw: string): string {
  let text = ''
  let i = 0

  while (i < raw.length) {
    const char = raw[i]!

    if (char !== '\\') {
      text += char
      i += 1
      continue
    }

    const rest = raw.slice(i)
    const continuation = LINE_CONTINUATION.exec(rest)
    const unicode = UNICODE_ESCAPE.exec(rest.slice(1))

    if (continuation !== null) {
      i += continuation[0].length
    } else if (unicode !== null) {
      text += String.fromCodePoint(parseInt(unicode[1] ?? unicode[2]!, HEX))
      i += 1 + unicode[0].length
    } else {
      text += ESCAPES[rest[1] ?? ''] ?? rest.slice(0, 2)
      i += 2
    }
  }

  return text
}

function basicEnd(text: string, from: number, quote: string): number {
  let i = from

  while (i < text.length && !text.startsWith(quote, i)) {
    i += text[i] === '\\' ? 2 : 1
  }

  return i
}

type Read = { value: TomlValue | undefined; end: number }

function readValue(text: string, at: number): Read {
  const literalEnd = (quote: string) => {
    const end = text.indexOf(quote, at + quote.length)

    return end === -1 ? text.length : end
  }

  if (text.startsWith(MULTILINE_BASIC, at)) {
    const end = basicEnd(text, at + MULTILINE_BASIC.length, MULTILINE_BASIC)
    const raw = text.slice(at + MULTILINE_BASIC.length, end).replace(LEADING_NEWLINE, '')

    return { value: unescape(raw), end: end + MULTILINE_BASIC.length }
  }

  if (text.startsWith(MULTILINE_LITERAL, at)) {
    const end = literalEnd(MULTILINE_LITERAL)
    const raw = text.slice(at + MULTILINE_LITERAL.length, end).replace(LEADING_NEWLINE, '')

    return { value: raw, end: end + MULTILINE_LITERAL.length }
  }

  if (text[at] === '"') {
    const end = basicEnd(text, at + 1, '"')

    return { value: unescape(text.slice(at + 1, end)), end: end + 1 }
  }

  if (text[at] === "'") {
    const end = literalEnd("'")

    return { value: text.slice(at + 1, end), end: end + 1 }
  }

  const lineEnd = text.indexOf('\n', at)
  const end = lineEnd === -1 ? text.length : lineEnd
  const raw = text.slice(at, end).replace(/#.*/, '').trim()
  const value = raw === 'true' ? true : raw === 'false' ? false : undefined

  return { value, end }
}

function lineEndAfter(text: string, at: number): number {
  const lineEnd = text.indexOf('\n', at)

  return lineEnd === -1 ? text.length : lineEnd + 1
}

export function tomlTable(text: string, name: string): Table {
  const table: Table = {}
  let current = ''
  let at = 0

  while (at < text.length) {
    const line = text.slice(at, lineEndAfter(text, at)).trimEnd()
    const header = HEADER.exec(line)
    const key = KEY.exec(line)

    if (header !== null) {
      current = unquote(header[1]!)
    } else if (key !== null) {
      const { value, end } = readValue(text, at + key[0].length)

      if (current === name && value !== undefined) {
        table[unquote(key[1]!)] = value
      }

      at = lineEndAfter(text, end)
      continue
    }

    at = lineEndAfter(text, at)
  }

  return table
}
