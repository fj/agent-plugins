import { readFileSync } from "node:fs";
import { rename, writeFile } from "node:fs/promises";
import type { PriceTable } from "./prices.ts";

const HOUR_MS = 60 * 60 * 1000;
export const PRICE_REFRESH_AGE_MS = 24 * HOUR_MS;
const JSON_INDENT = 2;

export interface PriceCache {
  fetchedAt: number;
  prices: PriceTable;
}

export function isFresh(cache: PriceCache, now: number): boolean {
  return now - cache.fetchedAt < PRICE_REFRESH_AGE_MS;
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
