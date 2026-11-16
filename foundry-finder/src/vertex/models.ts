import { pickTemplate, type CatalogModel } from "../catalog.ts";
import { modelPrices, type PriceTable } from "./prices.ts";

export const VERTEX_API = "google-vertex";

export type VertexModelConfig = CatalogModel & { api: typeof VERTEX_API; cost: Record<string, number> };

function displayName(modelId: string): string {
  return modelId
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Builds a chat model from its closest catalog entry and its billing prices.
 * With a price table, a model must be in the catalog or have an online text output price.
 */
export function toVertexModelConfig(
  modelId: string,
  resourceName: string,
  location: string,
  catalog: CatalogModel[],
  prices: PriceTable | undefined,
): VertexModelConfig | undefined {
  const match = pickTemplate(catalog, modelId);
  if (!match) return undefined;

  const known = prices ? modelPrices(prices, modelId, location) : {};
  if (prices && known.output === undefined && !match.exact) return undefined;

  const { provider, ...metadata } = match.template;
  const baseName = match.exact ? match.template.name : displayName(modelId);
  return {
    ...metadata,
    id: modelId,
    name: `${baseName} (${resourceName})`,
    api: VERTEX_API,
    cost: { ...(metadata.cost as Record<string, number>), ...known },
  };
}
