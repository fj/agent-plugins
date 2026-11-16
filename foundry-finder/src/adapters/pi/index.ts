import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { googleVertexApi } from "@earendil-works/pi-ai/compat";
import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { getAgentDir, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { CatalogLookup } from "../../catalog.ts";
import { parseConfig, type FoundryResourceConfig, type ResourceConfig, type VertexResourceConfig } from "../../config.ts";
import { LOG_PREFIX } from "../../log.ts";
import { registerResource } from "../../register.ts";
import { filePriceStore } from "../../vertex/price-store.ts";
import { registerVertexResources } from "../../vertex/register.ts";

const CONFIG_FILE = "foundry-finder.json";
const PRICE_CACHE_FILE = "foundry-finder-vertex-prices.json";

const lookup: CatalogLookup = (catalog) => getBuiltinModels(catalog) as any[];

export default async function (pi: ExtensionAPI) {
  const configPath = join(getAgentDir(), CONFIG_FILE);
  if (!existsSync(configPath)) return;

  let resources: ResourceConfig[];
  try {
    resources = parseConfig(readFileSync(configPath, "utf8"));
  } catch (error) {
    console.error(`${LOG_PREFIX}: invalid ${configPath}: ${error}`);
    return;
  }

  const registerProvider = pi.registerProvider.bind(pi) as (id: string, registration: any) => void;
  const foundry = resources.filter((resource): resource is FoundryResourceConfig => resource.type !== "vertex");
  const vertex = resources.filter((resource): resource is VertexResourceConfig => resource.type === "vertex");
  await Promise.all([
    ...foundry.map((resource) => registerResource(resource, { registerProvider, lookup })),
    registerVertexResources(vertex, {
      registerProvider,
      lookup,
      streamSimple: googleVertexApi().streamSimple,
      priceStore: filePriceStore(join(getAgentDir(), PRICE_CACHE_FILE)),
    }),
  ]);
}
