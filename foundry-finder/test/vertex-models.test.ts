import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogModel } from "../src/catalog.ts";
import { toVertexModelConfig } from "../src/vertex/models.ts";

const CATALOG_COST = { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 0 };

const CATALOG: CatalogModel[] = [
  { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro", provider: "google-vertex", contextWindow: 1_048_576, cost: { ...CATALOG_COST } },
  {
    id: "gemini-4-argon",
    name: "Gemini 4 Argon",
    provider: "google-vertex",
    api: "google-vertex",
    baseUrl: "https://{location}-aiplatform.googleapis.com",
    contextWindow: 1_048_576,
    thinkingLevelMap: { off: null, low: "low" },
    cost: { ...CATALOG_COST },
  },
];

const PRICES = {
  "Gemini 4 Argon Global Text Input - Online Predictions": 4,
  "Gemini 4 Argon Global Text Output - Online Predictions": 20,
  "Gemini 4 Argon Global Text Input Caching Online": 0.2,
  "Gemini 4 Hydrogen Global Text Input - Online Predictions": 1.5,
  "Gemini 4 Hydrogen Global Text Output - Online Predictions": 7.5,
  "Gemini 2.5 Pro Tts Global Text Input - Online Predictions": 1,
};

function configFor(modelId: string, prices: Record<string, number> | null = PRICES) {
  return toVertexModelConfig(modelId, "Acme", "global", CATALOG, prices ?? undefined);
}

describe("toVertexModelConfig", () => {
  it("keeps catalog metadata and replaces the catalog cost with billing prices", () => {
    assert.deepEqual(configFor("gemini-4-argon"), {
      id: "gemini-4-argon",
      name: "Gemini 4 Argon (Acme)",
      api: "google-vertex",
      baseUrl: "https://{location}-aiplatform.googleapis.com",
      contextWindow: 1_048_576,
      thinkingLevelMap: { off: null, low: "low" },
      cost: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 0 },
    });
  });

  it("borrows metadata from the closest relative and names the model after its id", () => {
    const model = configFor("gemini-4-hydrogen");
    assert.equal(model?.name, "Gemini 4 Hydrogen (Acme)");
    assert.deepEqual(model?.thinkingLevelMap, { off: null, low: "low" });
    assert.deepEqual(model?.cost, { input: 1.5, output: 7.5, cacheRead: 0.1, cacheWrite: 0 });
  });

  it("keeps an exact catalog model without billing prices at its catalog cost", () => {
    assert.deepEqual(configFor("gemini-2.5-pro")?.cost, CATALOG_COST);
  });

  it("skips a relative-only model that has no online text output price", () => {
    assert.equal(configFor("gemini-2.5-pro-tts"), undefined);
  });

  it("keeps every model with catalog metadata when there is no price table", () => {
    assert.deepEqual(configFor("gemini-2.5-pro-tts", null)?.cost, CATALOG_COST);
  });

  it("skips a model with no same-family catalog model", () => {
    assert.equal(configFor("imagen-4"), undefined);
  });

  it("does not change the catalog entry", () => {
    configFor("gemini-4-argon");
    assert.deepEqual(CATALOG[1].cost, CATALOG_COST);
  });
});
