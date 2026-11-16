import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { filePriceStore, isFresh, PRICE_REFRESH_AGE_MS } from "../src/vertex/price-store.ts";

describe("isFresh", () => {
  const fetchedAt = 1_000;

  it("is fresh before the refresh age", () => {
    assert.equal(isFresh({ fetchedAt, prices: {} }, fetchedAt + PRICE_REFRESH_AGE_MS - 1), true);
  });

  it("is stale at the refresh age", () => {
    assert.equal(isFresh({ fetchedAt, prices: {} }, fetchedAt + PRICE_REFRESH_AGE_MS), false);
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
