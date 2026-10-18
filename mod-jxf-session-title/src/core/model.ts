export type TitleModel = { provider: string; id: string }

const PROVIDER_SEPARATOR = '/'

export function modelLabel(model: TitleModel): string {
  return `${model.provider}${PROVIDER_SEPARATOR}${model.id}`
}

export function resolveModelSpec(spec: string, currentProvider: string | undefined): TitleModel | undefined {
  const separator = spec.indexOf(PROVIDER_SEPARATOR)

  if (separator < 0) {
    return currentProvider === undefined || spec === '' ? undefined : { provider: currentProvider, id: spec }
  }

  const provider = spec.slice(0, separator)
  const id = spec.slice(separator + 1)

  return provider === '' || id === '' ? undefined : { provider, id }
}
