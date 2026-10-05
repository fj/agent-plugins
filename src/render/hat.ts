import { seg, type Line } from './segment.ts'

const HAT = '🎩'
export const BANNER_TEXT = 'mod-jxf-fancy-details is on'

export function topHat(): Line[] {
  return [[seg(`${HAT} `), seg(BANNER_TEXT)]]
}
