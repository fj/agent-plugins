import { seg, type Line } from './segment.ts'

export const BANNER_TEXT = 'mod-jxf-fancy is on'

const TEXT_ROW = 4
const GAP = '    '

const ART: readonly Line[] = [
  [seg('   ███', 'hat')],
  [seg('   ███', 'hatBand')],
  [seg('  ▀▀▀▀▀', 'hat')],
  [seg(' ▐▛███▜▌', 'robot')],
  [seg('▝▜█████▛▘', 'robot')],
  [seg('  ▘▘ ▝▝', 'robot')],
]

export function topHatRobot(): Line[] {
  const width = Math.max(...ART.map(line => [...line.map(s => s.text).join('')].length))

  return ART.map((line, row) => {
    const used = [...line.map(s => s.text).join('')].length

    return row === TEXT_ROW ? [...line, seg(' '.repeat(width - used) + GAP), seg(BANNER_TEXT)] : [...line]
  })
}
