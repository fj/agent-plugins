import { family, pickTemplate, type Catalog, type CatalogLookup } from "./catalog.ts";
import type { Deployment } from "./discovery.ts";

export type { Catalog, CatalogLookup, CatalogModel } from "./catalog.ts";

interface Route {
  api: "anthropic-messages" | "openai-responses";
  path: string;
  catalog: Catalog;
  unsupportedCompat: readonly string[];
}

// Foundry rejects strict tool schemas and is not a faithful Messages transport for mid-conversation effort.
const ANTHROPIC_ROUTE: Route = {
  api: "anthropic-messages",
  path: "/anthropic",
  catalog: "anthropic",
  unsupportedCompat: ["supportsStrictTools", "supportsMidConvoEffort"],
};

const OPENAI_ROUTE: Route = {
  api: "openai-responses",
  path: "/openai/v1",
  catalog: "azure-openai-responses",
  unsupportedCompat: [],
};

function routeFor(model: string): Route {
  return family(model) === "claude" ? ANTHROPIC_ROUTE : OPENAI_ROUTE;
}

export function toModelConfig(
  deployment: Deployment,
  endpoint: string,
  resourceName: string,
  lookup: CatalogLookup,
) {
  const route = routeFor(deployment.model);
  const match = pickTemplate(lookup(route.catalog), deployment.model);
  if (!match) return undefined;

  const { provider, compat = {}, ...metadata } = match.template;
  const supportedCompat = Object.fromEntries(
    Object.entries(compat).filter(([key]) => !route.unsupportedCompat.includes(key)),
  );
  const baseName = match.exact ? match.template.name : deployment.id;
  return {
    ...metadata,
    id: deployment.id,
    name: `${baseName} (${resourceName})`,
    api: route.api,
    baseUrl: `${endpoint}${route.path}`,
    compat: supportedCompat,
  };
}
