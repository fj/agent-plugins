export type Catalog = "anthropic" | "azure-openai-responses";

export interface CatalogModel {
  id: string;
  name: string;
  provider?: string;
  compat?: Record<string, unknown>;
  [field: string]: unknown;
}

export type CatalogLookup = (catalog: Catalog) => CatalogModel[];

export function family(modelId: string): string {
  return modelId.split("-")[0];
}

function commonPrefixLength(a: string, b: string): number {
  let length = 0;
  while (length < a.length && a[length] === b[length]) length++;
  return length;
}

/** Finds the catalog entry for a model, or failing that its closest same-family relative. */
export function pickTemplate(
  catalog: CatalogModel[],
  model: string,
): { template: CatalogModel; exact: boolean } | undefined {
  const exact = catalog.find((entry) => entry.id === model);
  if (exact) return { template: exact, exact: true };

  const relatives = catalog.filter((entry) => family(entry.id) === family(model));
  if (relatives.length === 0) return undefined;
  const closest = relatives.reduce((best, entry) =>
    commonPrefixLength(entry.id, model) > commonPrefixLength(best.id, model) ? entry : best,
  );
  return { template: closest, exact: false };
}
