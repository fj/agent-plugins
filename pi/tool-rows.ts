type MouseEvent = { y: number; height: number }

export type ToolRow = {
  toolCallId: string
  render(width: number): string[]
  handleMouse?(event: MouseEvent): unknown
}

export type ToolRowPrototype = Pick<ToolRow, 'render' | 'handleMouse'>

export type ToolTimerLine = (toolCallId: string, width: number) => string | undefined

function insertBelowGap(lines: readonly string[], line: string): { lines: string[]; row: number } {
  const row = lines[0] === '' ? 1 : 0

  return { lines: [...lines.slice(0, row), line, ...lines.slice(row)], row }
}

export function patchToolRows(proto: ToolRowPrototype, timerLine: ToolTimerLine): () => void {
  const { render, handleMouse } = proto
  const ownsMouse = Object.hasOwn(proto, 'handleMouse')
  const timerRows = new WeakMap<object, number>()

  proto.render = function (this: ToolRow, width: number) {
    const lines = render.call(this, width)
    const line = lines.length === 0 ? undefined : timerLine(this.toolCallId, width)

    if (line === undefined) {
      timerRows.delete(this)

      return lines
    }

    const placed = insertBelowGap(lines, line)

    timerRows.set(this, placed.row)

    return placed.lines
  }

  proto.handleMouse = function (this: ToolRow, event: MouseEvent) {
    const row = timerRows.get(this)

    if (row === undefined || handleMouse === undefined) {
      return handleMouse?.call(this, event)
    }

    if (event.y === row) {
      return undefined
    }

    const y = event.y > row ? event.y - 1 : event.y

    return handleMouse.call(this, { ...event, y, height: event.height - 1 })
  }

  return () => {
    proto.render = render

    if (ownsMouse) {
      proto.handleMouse = handleMouse
    } else {
      delete proto.handleMouse
    }
  }
}
