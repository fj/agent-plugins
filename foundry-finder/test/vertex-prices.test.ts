import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import {
  fetchPriceTable,
  filePriceStore,
  isFresh,
  modelPrices,
  PRICE_REFRESH_AGE_MS,
  toPriceTable,
} from "../src/vertex/prices.ts";

function sku(description: string, nanos: number, usageUnit = "count", units = "0") {
  return {
    description,
    pricingInfo: [{ pricingExpression: { usageUnit, tieredRates: [{ startUsageAmount: 0, unitPrice: { units, nanos } }] } }],
  };
}

describe("toPriceTable", () => {
  it("converts per-token prices to USD per million tokens", () => {
    const table = toPriceTable([
      sku("Gemini 4 Argon Global Text Input - Online Predictions", 4_000),
      sku("Gemini 4 Argon Global Text Output - Online Predictions", 20_000),
      sku("Gemini 4 Hydrogen Global Text Input Caching Online", 75),
      sku("Gemini 9 Pricey Global Text Output - Online Predictions", 500_000_000, "count", "1"),
    ]);
    assert.deepEqual(table, {
      "Gemini 4 Argon Global Text Input - Online Predictions": 4,
      "Gemini 4 Argon Global Text Output - Online Predictions": 20,
      "Gemini 4 Hydrogen Global Text Input Caching Online": 0.075,
      "Gemini 9 Pricey Global Text Output - Online Predictions": 1_500_000,
    });
  });

  it("drops batch, CodeMender, non-text, non-token, and unpriced SKUs", () => {
    const table = toPriceTable([
      sku("Gemini 3.5 Flash Global Text Output - Batch Predictions", 1),
      sku("CodeMender Gemini 4 Argon Global Text Output", 1),
      sku("Gemini 3.1 Flash Image Regional Image Output - Online Predictions", 1),
      sku("Gemini 4 Argon Global Text Output - Online Predictions", 1, "h"),
      { description: "Gemini 4 Argon Regional Text Output - Online Predictions" },
      sku("Gemini 4 Argon Regional Text Input - Online Predictions", 1, "count", "not a number"),
    ]);
    assert.deepEqual(table, {});
  });
});

describe("fetchPriceTable", () => {
  it("reads every page of the Vertex AI SKU list in USD", async () => {
    const requests: Request[] = [];
    const pages = [
      { skus: [sku("Gemini 4 Argon Global Text Output - Online Predictions", 20_000)], nextPageToken: "two" },
      { skus: [sku("Gemini 4 Argon Global Text Input - Online Predictions", 4_000)] },
    ];
    const fetch: typeof globalThis.fetch = async (input, init) => {
      requests.push(new Request(input, init));
      return new Response(JSON.stringify(pages[requests.length - 1]));
    };
    const table = await fetchPriceTable({ accessToken: "token", project: "acme" }, { fetch });
    assert.equal(Object.keys(table).length, 2);
    const url = new URL(requests[0].url);
    assert.equal(url.pathname, "/v1/services/C7E2-9256-1C43/skus");
    assert.equal(url.searchParams.get("currencyCode"), "USD");
    assert.equal(new URL(requests[1].url).searchParams.get("pageToken"), "two");
  });
});

describe("isFresh", () => {
  const fetchedAt = 1_000;

  it("is fresh before the refresh age", () => {
    assert.equal(isFresh({ fetchedAt, prices: {} }, fetchedAt + PRICE_REFRESH_AGE_MS - 1), true);
  });

  it("is stale at the refresh age", () => {
    assert.equal(isFresh({ fetchedAt, prices: {} }, fetchedAt + PRICE_REFRESH_AGE_MS), false);
  });
});

describe("modelPrices", () => {
  const table = {
    "Gemini 4 Argon Global Text Input - Online Predictions": 4,
    "Gemini 4 Argon Global Text Output - Online Predictions": 20,
    "Gemini 4 Argon Global Text Input Caching Online": 0.2,
    "Gemini 4 Argon Regional Text Input - Online Predictions": 4.4,
    "Gemini 4 Argon Regional Text Output - Online Predictions": 22,
    "Gemini 4 Argon Cyber Permissive Global Text Output - Online Predictions": 99,
    "Gemini 3.8 Live Text Output - Online Predictions": 4.5,
    "Gemini Robotics ER 2 Global Text Output - Online Predictions": 1,
    "Gemini 3.1 Flash Image Regional Text Output - Online Predictions": 3.3,
  };

  it("uses the Global SKUs for the global location", () => {
    assert.deepEqual(modelPrices(table, "gemini-4-argon", "global"), { input: 4, output: 20, cacheRead: 0.2 });
  });

  it("uses the Regional SKUs for a regional location and falls back for missing ones", () => {
    assert.deepEqual(modelPrices(table, "gemini-4-argon", "us-central1"), { input: 4.4, output: 22, cacheRead: 0.2 });
  });

  it("matches SKUs without a scope", () => {
    assert.equal(modelPrices(table, "gemini-3.8-live", "global").output, 4.5);
  });

  it("falls back to the other scope", () => {
    assert.equal(modelPrices(table, "gemini-3.1-flash-image", "global").output, 3.3);
  });

  it("ignores case differences between the model id and the SKU", () => {
    assert.equal(modelPrices(table, "gemini-robotics-er-2", "global").output, 1);
  });

  it("does not match SKUs of model variants", () => {
    assert.deepEqual(modelPrices(table, "gemini-4", "global"), {});
  });

  it("returns no prices for an unknown model", () => {
    assert.deepEqual(modelPrices(table, "gemini-4-carbon", "global"), {});
  });
});

describe("filePriceStore", () => {
  let dir: string;
  const cache = { fetchedAt: 1_000, prices: { "Gemini 4 Argon Global Text Output - Online Predictions": 20 } };

  before(async () => {
    dir = await mkdtemp(join(tmpdir(), "foundry-finder-prices-"));
  });

  after(() => rm(dir, { recursive: true, force: true }));

  it("loads what it saved and leaves no partial file", async () => {
    const store = filePriceStore(join(dir, "saved.json"));
    await store.save(cache);
    assert.deepEqual(store.load(), cache);
    assert.deepEqual(await readdir(dir), ["saved.json"]);
  });

  it("has no cache when the file is missing", () => {
    const path = join(dir, "missing.json");
    assert.equal(existsSync(path), false);
    assert.equal(filePriceStore(path).load(), undefined);
  });

  it("has no cache when the file is invalid", async () => {
    const path = join(dir, "invalid.json");
    await writeFile(path, "{ not json");
    assert.equal(filePriceStore(path).load(), undefined);
    await writeFile(path, JSON.stringify({ prices: {} }));
    assert.equal(filePriceStore(path).load(), undefined);
    await writeFile(path, JSON.stringify({ fetchedAt: 1, prices: null }));
    assert.equal(filePriceStore(path).load(), undefined);
  });
});
