import assert from 'node:assert/strict'
import { test } from 'node:test'

import { catalogRates, piPricer, reportedCost, type CatalogModel, type ModelCatalog } from '../../../src/adapters/pi/pricing.ts'
import { defaultUsageStrategy } from '../../../src/strategies/usage/default.ts'

const MTOK = 1_000_000
const CARBON: CatalogModel = {
  provider: 'tsdev-jxf-vertex',
  id: 'gemini-4-carbon',
  cost: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 0 },
}
const CARBON_REGIONAL: CatalogModel = {
  provider: 'tsdev-regional-vertex',
  id: 'gemini-4-carbon',
  cost: { input: 4.4, output: 22, cacheRead: 0.22, cacheWrite: 0 },
}
const BRIDGE_OPUS: CatalogModel = {
  provider: 'claude-bridge',
  id: 'claude-opus-5-5',
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}
const UNPRICED: CatalogModel = {
  provider: 'ollama',
  id: 'llama-local',
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
}

function fakeCatalog(models: readonly CatalogModel[]): ModelCatalog {
  return {
    find: (provider, id) => models.find(entry => entry.provider === provider && entry.id === id),
    getAll: () => models,
  }
}

test('reportedCost accepts positive catalog totals and zero provider-billed totals', () => {
  assert.deepEqual(reportedCost({ cost: { total: 0.1436, totalFromProvider: false } }), {
    usd: 0.1436,
    isLowerBound: false,
  })
  assert.deepEqual(reportedCost({ cost: { total: 0, totalFromProvider: true } }), {
    usd: 0,
    isLowerBound: false,
  })
  assert.equal(reportedCost({ cost: { total: 0, totalFromProvider: false } }), undefined)
  assert.equal(reportedCost({ cost: { total: -1, totalFromProvider: true } }), undefined)
  assert.equal(reportedCost({}), undefined)
  assert.equal(reportedCost(undefined), undefined)
})

test('catalogRates resolves provider-qualified, nested-slash, decorated and bare model names', () => {
  const openRouterGemini: CatalogModel = {
    provider: 'openrouter',
    id: 'google/gemini-2.5-pro',
    cost: { input: 1.25, output: 10, cacheRead: 0.31, cacheWrite: 0 },
  }
  const catalog = fakeCatalog([CARBON, CARBON_REGIONAL, openRouterGemini, UNPRICED])

  assert.deepEqual(catalogRates('tsdev-jxf-vertex/gemini-4-carbon', catalog), CARBON.cost)
  assert.deepEqual(catalogRates('tsdev-regional-vertex/gemini-4-carbon:high', catalog), CARBON_REGIONAL.cost)
  assert.deepEqual(catalogRates('openrouter/google/gemini-2.5-pro', catalog), openRouterGemini.cost)
  assert.deepEqual(catalogRates('google/gemini-2.5-pro', catalog, openRouterGemini), openRouterGemini.cost)
  assert.deepEqual(catalogRates('gemini-4-carbon', catalog, CARBON_REGIONAL), CARBON_REGIONAL.cost)
  assert.deepEqual(catalogRates('gemini-4-carbon', catalog), CARBON.cost)
  assert.equal(catalogRates('ollama/llama-local', catalog, UNPRICED), undefined)
  assert.equal(catalogRates('', catalog), undefined)
})

test('piPricer keeps strategy rates for claude-bridge and prices Vertex models from catalog', () => {
  const catalog = fakeCatalog([BRIDGE_OPUS, CARBON, UNPRICED])
  const price = piPricer(defaultUsageStrategy.price, () => catalog, () => CARBON)
  const sample = { input: MTOK, cacheRead: MTOK, cacheWrite: 0, output: MTOK }

  const opus = price('claude-bridge/claude-opus-5-5', sample)
  const carbon = price('gemini-4-carbon', sample)
  const local = price('ollama/llama-local', sample)

  assert.deepEqual(opus, { usd: 24.2, isLowerBound: false })
  assert.deepEqual(carbon, { usd: 24.2, isLowerBound: false })
  assert.deepEqual(local, { usd: 0, isLowerBound: true })
})
