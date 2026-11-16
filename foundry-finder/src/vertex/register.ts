import type { CatalogLookup } from "../catalog.ts";
import { resolveSecret, type VertexResourceConfig } from "../config.ts";
import { LOG_PREFIX } from "../log.ts";
import { fetchGeminiModels } from "./discovery.ts";
import type { GoogleCredentials } from "./google-api.ts";
import { toVertexModelConfig, VERTEX_API, type VertexModelConfig } from "./models.ts";
import { isFresh, type PriceStore } from "./price-store.ts";
import { fetchPriceTable, type PriceTable } from "./prices.ts";

// pi's google-vertex API reads this key as "use Application Default Credentials".
const ADC_API_KEY = "gcp-vertex-credentials";
const VERTEX_BASE_URL = "https://{location}-aiplatform.googleapis.com";

type StreamOptions = { env?: Record<string, string> } & Record<string, unknown>;
export type StreamSimple<Model = any, Context = any, Stream = any> = (
  model: Model,
  context: Context,
  options?: StreamOptions,
) => Stream;

export interface VertexProviderRegistration {
  name: string;
  baseUrl: string;
  apiKey: string;
  api: typeof VERTEX_API;
  streamSimple: StreamSimple;
  models: VertexModelConfig[];
}

export interface VertexDependencies {
  registerProvider: (id: string, registration: VertexProviderRegistration) => void;
  lookup: CatalogLookup;
  streamSimple: StreamSimple;
  priceStore: PriceStore;
  listModels?: (credentials: GoogleCredentials) => Promise<string[]>;
  fetchPrices?: (credentials: GoogleCredentials) => Promise<PriceTable>;
  resolveToken?: (value: string) => string | undefined;
  now?: () => number;
  log?: (message: string) => void;
}

interface DiscoveredResource {
  resource: VertexResourceConfig;
  credentials: GoogleCredentials;
  modelIds: string[];
}

/** Routes requests to the resource's project and location through provider-scoped env, not process env. */
function withVertexTarget(
  stream: StreamSimple,
  { project, location }: Pick<VertexResourceConfig, "project" | "location">,
): StreamSimple {
  return (model, context, options) =>
    stream(model, context, {
      ...options,
      env: { ...options?.env, GOOGLE_CLOUD_PROJECT: project, GOOGLE_CLOUD_LOCATION: location },
    });
}

/**
 * Registers each resource's Gemini models with the cached prices, then refreshes a stale cache in the background.
 * The returned `refreshed` promise settles when the background refresh ends; startup does not wait for it.
 */
export async function registerVertexResources(
  resources: VertexResourceConfig[],
  {
    registerProvider,
    lookup,
    streamSimple,
    priceStore,
    listModels = fetchGeminiModels,
    fetchPrices = fetchPriceTable,
    resolveToken = resolveSecret,
    now = Date.now,
    log = console.error,
  }: VertexDependencies,
): Promise<{ refreshed: Promise<void> }> {
  const register = ({ resource, modelIds }: DiscoveredResource, prices: PriceTable | undefined) => {
    const models = modelIds.flatMap(
      (modelId) => toVertexModelConfig(modelId, resource.name, resource.location, lookup(VERTEX_API), prices) ?? [],
    );
    registerProvider(resource.provider, {
      name: resource.name,
      baseUrl: VERTEX_BASE_URL,
      apiKey: ADC_API_KEY,
      api: VERTEX_API,
      streamSimple: withVertexTarget(streamSimple, resource),
      models,
    });
  };

  const discover = async (resource: VertexResourceConfig): Promise<DiscoveredResource | undefined> => {
    const warn = (message: string) => log(`${LOG_PREFIX}: ${resource.provider}: ${message}`);
    try {
      const accessToken = resolveToken(resource.accessToken);
      if (!accessToken) {
        warn("access token is not set; skipping");
        return undefined;
      }
      const credentials = { accessToken, project: resource.project };
      return { resource, credentials, modelIds: await listModels(credentials) };
    } catch (error) {
      warn(`discovery failed: ${error}`);
      return undefined;
    }
  };

  const cache = priceStore.load();
  const discovered = (await Promise.all(resources.map(discover))).filter((entry) => entry !== undefined);
  for (const entry of discovered) register(entry, cache?.prices);

  if (discovered.length === 0 || (cache && isFresh(cache, now()))) return { refreshed: Promise.resolve() };

  const refreshed = (async () => {
    const prices = await fetchPrices(discovered[0].credentials);
    await priceStore.save({ fetchedAt: now(), prices });
    for (const entry of discovered) register(entry, prices);
  })().catch((error) => log(`${LOG_PREFIX}: Vertex price refresh failed: ${error}`));
  return { refreshed };
}
