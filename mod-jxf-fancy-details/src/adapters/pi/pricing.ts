import type { Cost } from '../../core/cost.ts'
import type { Pricer } from '../../core/ledger.ts'
import type { TokenUsage } from '../../core/usage.ts'
import { canonicalModel, hasKnownRates, priceWithRates, type Rates } from '../../strategies/usage/pricing.ts'

export type CatalogModel = { id: string; provider: string; cost?: Rates }

export type ModelCatalog = {
  find?(provider: string, modelId: string): CatalogModel | undefined
  getAll?(): readonly CatalogModel[]
}

export type PiUsageCost = { total?: number; totalFromProvider?: boolean }

export type PiMessageUsage = Partial<TokenUsage> & { cost?: PiUsageCost }

const MODEL_DECORATION = /[@:].*$/
const PROVIDER_SEPARATOR = '/'

export function reportedCost(usage: PiMessageUsage | undefined): Cost | undefined {
  const total = usage?.cost?.total

  if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
    return undefined
  }

  if (usage?.cost?.totalFromProvider === true || total > 0) {
    return { usd: total, isLowerBound: false }
  }

  return undefined
}

function splitProviderModel(model: string): { provider?: string; id: string } {
  const trimmed = model.trim()
  const slash = trimmed.indexOf(PROVIDER_SEPARATOR)

  return slash === -1
    ? { id: trimmed }
    : { provider: trimmed.slice(0, slash), id: trimmed.slice(slash + 1) }
}

function bareModelId(id: string): string {
  return id.replace(MODEL_DECORATION, '')
}

function matchesId(candidateId: string, raw: string, id: string): boolean {
  return (
    candidateId === raw ||
    candidateId === bareModelId(raw) ||
    candidateId === id ||
    candidateId === bareModelId(id)
  )
}

function matchesActiveModel(
  activeModel: CatalogModel,
  raw: string,
  provider: string | undefined,
  id: string,
  canonical: string,
): boolean {
  if (activeModel.id === raw || activeModel.id === bareModelId(raw)) {
    return true
  }

  const sameProvider = provider === undefined || activeModel.provider === provider

  return sameProvider && (matchesId(activeModel.id, raw, id) || (canonical !== '' && canonicalModel(activeModel.id) === canonical))
}

function findProviderRates(catalog: ModelCatalog | undefined, provider: string, id: string): Rates | undefined {
  const exact = catalog?.find?.(provider, id)

  if (hasKnownRates(exact?.cost)) {
    return exact.cost
  }

  const bare = bareModelId(id)
  const stripped = bare === id ? undefined : catalog?.find?.(provider, bare)

  return hasKnownRates(stripped?.cost) ? stripped.cost : undefined
}

export function catalogRates(
  model: string,
  catalog: ModelCatalog | undefined,
  activeModel?: CatalogModel,
): Rates | undefined {
  const raw = model.trim()
  const { provider, id } = splitProviderModel(raw)

  if (id === '') {
    return undefined
  }

  if (provider !== undefined) {
    const direct = findProviderRates(catalog, provider, id)

    if (direct !== undefined) {
      return direct
    }
  }

  const canonical = canonicalModel(raw)

  if (
    activeModel !== undefined &&
    matchesActiveModel(activeModel, raw, provider, id, canonical) &&
    hasKnownRates(activeModel.cost)
  ) {
    return activeModel.cost
  }

  const all = (catalog?.getAll?.() ?? []).filter(entry => hasKnownRates(entry.cost))
  const exact = all.find(entry => matchesId(entry.id, raw, id))

  if (exact?.cost !== undefined) {
    return exact.cost
  }

  return canonical === '' ? undefined : all.find(entry => canonicalModel(entry.id) === canonical)?.cost
}

export function piPricer(
  base: Pricer,
  catalog: () => ModelCatalog | undefined,
  activeModel: () => CatalogModel | undefined,
): Pricer {
  return (model, usage) => {
    const priced = base(model, usage)

    if (!priced.isLowerBound) {
      return priced
    }

    const rates = catalogRates(model, catalog(), activeModel())

    return rates === undefined ? priced : priceWithRates(rates, usage)
  }
}
