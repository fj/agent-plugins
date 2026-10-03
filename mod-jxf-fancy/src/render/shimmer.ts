const HUE_DEGREES = 360
const DEGREES_PER_SECOND = 240
const DEGREES_PER_CHAR = 18
const SATURATION = 0.85
const LIGHTNESS = 0.65
const MS_PER_SECOND = 1000

function hslToHex(hue: number, s: number, l: number): string {
  const k = (n: number) => (n + hue / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const channel = (n: number) => {
    const value = l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))

    return Math.round(value * 255).toString(16).padStart(2, '0')
  }

  return `#${channel(0)}${channel(8)}${channel(4)}`
}

export function rainbow(nowMs: number, index: number): string {
  const hue = (nowMs / MS_PER_SECOND) * DEGREES_PER_SECOND - index * DEGREES_PER_CHAR

  return hslToHex(((hue % HUE_DEGREES) + HUE_DEGREES) % HUE_DEGREES, SATURATION, LIGHTNESS)
}

export function shimmer(text: string, nowMs: number): { char: string; color: string }[] {
  return [...text].map((char, i) => ({ char, color: rainbow(nowMs, i) }))
}
