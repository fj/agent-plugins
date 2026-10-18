const TRUTHY = /^(1|true|yes|on)$/i

export function isEnvSet(value: string | undefined): boolean {
  return value !== undefined && TRUTHY.test(value.trim())
}
