import { readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import type { FetchOptions } from "../http.ts";
import { fetchAllPages, type GoogleCredentials } from "./google-api.ts";

const VERTEX_SKUS_URL = "https://cloudbilling.googleapis.com/v1/services/C7E2-9256-1C43/skus?pageSize=5000&currencyCode=USD";
const BILLING_TIMEOUT_MS = 60_000;
const HOUR_MS = 60 * 60 * 1000;
export const PRICE_REFRESH_AGE_MS = 24 * HOUR_MS;

const PRICED_SKU_PATTERN = /^Gemini .* (Text (Input|Output) - Online Predictions|Text Input Caching Online)$/;
const PER_TOKEN_UNIT = "count";
const TOKENS_PER_MILLION = 1_000_000;
const NANOS_PER_UNIT = 1_000_000_000;
const JSON_INDENT = 2;

const GLOBAL_LOCATION = "global";
const INPUT_SUFFIX = "text input - online predictions";
const OUTPUT_SUFFIX = "text output - online predictions";
const CACHE_READ_SUFFIX = "text input caching online";

/** USD per million tokens, keyed by billing SKU description. */
export type PriceTable = Record<string, number>;

export interface PriceCache {
  fetchedAt: number;
  prices: PriceTable;
}

export interface ModelPrices {
  input?: number;
  output?: number;
  cacheRead?: number;
}

interface Sku {
  description: string;
  pricingInfo?: {
    pricingExpression?: {
      usageUnit?: string;
      tieredRates?: { unitPrice?: { units?: string; nanos?: number } }[];
    };
  }[];
}

function usdPerMillionTokens(sku: Sku): number | undefined {
  const expression = sku.pricingInfo?.[0]?.pricingExpression;
  const price = expression?.tieredRates?.[0]?.unitPrice;
  if (expression?.usageUnit !== PER_TOKEN_UNIT || !price) return undefined;
  const perMillion = Number(price.units ?? 0) * TOKENS_PER_MILLION + ((price.nanos ?? 0) * TOKENS_PER_MILLION) / NANOS_PER_UNIT;
  return Number.isFinite(perMillion) ? perMillion : undefined;
}

/** Keeps the online text-token SKUs for Gemini models and converts them to USD per million tokens. */
export function toPriceTable(skus: Sku[]): PriceTable {
  const table: PriceTable = {};
  for (const sku of skus) {
    if (!PRICED_SKU_PATTERN.test(sku.description)) continue;
    const price = usdPerMillionTokens(sku);
    if (price !== undefined) table[sku.description] = price;
  }
  return table;
}

export async function fetchPriceTable(
  credentials: GoogleCredentials,
  { fetch, timeoutMs = BILLING_TIMEOUT_MS }: FetchOptions = {},
): Promise<PriceTable> {
  return toPriceTable(await fetchAllPages<Sku>(VERTEX_SKUS_URL, "skus", credentials, { fetch, timeoutMs }));
}

export function isFresh(cache: PriceCache, now: number): boolean {
  return now - cache.fetchedAt < PRICE_REFRESH_AGE_MS;
}

/** Finds a model's known prices by SKU description, preferring the SKU that matches the location's scope. */
export function modelPrices(table: PriceTable, modelId: string, location: string): ModelPrices {
  const byDescription = new Map(Object.entries(table).map(([description, price]) => [description.toLowerCase(), price]));
  const model = modelId.replaceAll("-", " ");
  const scopes = location === GLOBAL_LOCATION ? ["global ", "", "regional "] : ["regional ", "", "global "];
  const find = (suffix: string) =>
    scopes.map((scope) => byDescription.get(`${model} ${scope}${suffix}`)).find((price) => price !== undefined);
  const prices = { input: find(INPUT_SUFFIX), output: find(OUTPUT_SUFFIX), cacheRead: find(CACHE_READ_SUFFIX) };
  return Object.fromEntries(Object.entries(prices).filter(([, price]) => price !== undefined));
}

export interface PriceStore {
  load(): PriceCache | undefined;
  save(cache: PriceCache): Promise<void>;
}

function parsePriceCache(text: string): PriceCache | undefined {
  const { fetchedAt, prices } = JSON.parse(text);
  if (typeof fetchedAt !== "number" || typeof prices !== "object" || prices === null) return undefined;
  return { fetchedAt, prices };
}

/** Stores the price cache as JSON; a missing or unreadable file counts as no cache. */
export function filePriceStore(path: string): PriceStore {
  return {
    load() {
      try {
        return parsePriceCache(readFileSync(path, "utf8"));
      } catch {
        return undefined;
      }
    },
    async save(cache) {
      const partial = `${path}.${process.pid}.tmp`;
      await writeFile(partial, `${JSON.stringify(cache, null, JSON_INDENT)}\n`);
      await rename(partial, path);
    },
  };
}
