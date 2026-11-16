import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { CatalogModel } from "../src/catalog.ts";
import type { VertexResourceConfig } from "../src/config.ts";
import type { GoogleCredentials } from "../src/vertex/google-api.ts";
import { PRICE_REFRESH_AGE_MS, type PriceCache } from "../src/vertex/price-store.ts";
import type { PriceTable } from "../src/vertex/prices.ts";
import {
  registerVertexResources,
  type VertexDependencies,
  type VertexProviderRegistration,
} from "../src/vertex/register.ts";

const NOW = 10 * PRICE_REFRESH_AGE_MS;

const RESOURCE: VertexResourceConfig = {
  type: "vertex",
  provider: "acme-vertex",
  name: "Acme",
  project: "acme-project",
  location: "global",
  accessToken: "!print-token",
};

const CATALOG: CatalogModel[] = [
  { id: "gemini-4-argon", name: "Gemini 4 Argon", cost: { input: 2, output: 10, cacheRead: 0.1, cacheWrite: 0 } },
];

const CACHED_PRICES: PriceTable = {
  "Gemini 4 Argon Global Text Output - Online Predictions": 20,
  "Gemini 4 Carbon Global Text Output - Online Predictions": 20,
};

const FRESH_PRICES: PriceTable = {
  "Gemini 4 Argon Global Text Output - Online Predictions": 21,
  "Gemini 4 Carbon Global Text Output - Online Predictions": 21,
};

function harness(cache: PriceCache | undefined, overrides: Partial<VertexDependencies> = {}) {
  const registered: [string, VertexProviderRegistration][] = [];
  const logs: string[] = [];
  const saved: PriceCache[] = [];
  const priceRequests: GoogleCredentials[] = [];
  const dependencies: VertexDependencies = {
    registerProvider: (id, registration) => registered.push([id, registration]),
    lookup: (catalog) => (catalog === "google-vertex" ? CATALOG : []),
    streamSimple: (_model, _context, options) => options,
    priceStore: {
      load: () => cache,
      save: async (next) => {
        saved.push(next);
      },
    },
    listModels: async () => ["gemini-4-argon", "gemini-4-carbon", "gemini-4-tts", "imagen-4"],
    fetchPrices: async (credentials) => {
      priceRequests.push(credentials);
      return FRESH_PRICES;
    },
    resolveToken: () => "token",
    now: () => NOW,
    log: (message) => logs.push(message),
    ...overrides,
  };
  return { dependencies, registered, logs, saved, priceRequests };
}

function modelIds(registration: VertexProviderRegistration) {
  return registration.models.map((model) => model.id);
}

function outputPrice(registration: VertexProviderRegistration, id: string) {
  return registration.models.find((model) => model.id === id)?.cost.output;
}

describe("registerVertexResources", () => {
  it("streams with the resource project and location in the provider env and keeps other options", async () => {
    const { dependencies, registered } = harness({ fetchedAt: NOW, prices: CACHED_PRICES });
    await registerVertexResources([RESOURCE], dependencies);
    const { streamSimple } = registered[0][1];
    assert.deepEqual(streamSimple({}, {}, { apiKey: "key", env: { OTHER: "1", GOOGLE_CLOUD_PROJECT: "wrong" } }), {
      apiKey: "key",
      env: { OTHER: "1", GOOGLE_CLOUD_PROJECT: "acme-project", GOOGLE_CLOUD_LOCATION: "global" },
    });
    assert.deepEqual(streamSimple({}, {}).env, { GOOGLE_CLOUD_PROJECT: "acme-project", GOOGLE_CLOUD_LOCATION: "global" });
  });

  it("registers a google-vertex provider that uses ADC and targets the resource", async () => {
    const { dependencies, registered } = harness({ fetchedAt: NOW, prices: CACHED_PRICES });
    await registerVertexResources([RESOURCE], dependencies);
    assert.equal(registered.length, 1);
    const [id, registration] = registered[0];
    assert.equal(id, "acme-vertex");
    assert.equal(registration.name, "Acme");
    assert.equal(registration.api, "google-vertex");
    assert.equal(registration.apiKey, "gcp-vertex-credentials");
    assert.equal(registration.baseUrl, "https://{location}-aiplatform.googleapis.com");
    assert.equal(registration.streamSimple({}, {}).env.GOOGLE_CLOUD_PROJECT, "acme-project");
  });

  it("prices a regional resource with the Regional SKUs", async () => {
    const regional = { ...RESOURCE, location: "us-central1" };
    const prices = {
      "Gemini 4 Argon Global Text Output - Online Predictions": 20,
      "Gemini 4 Argon Regional Text Output - Online Predictions": 22,
    };
    const { dependencies, registered } = harness({ fetchedAt: NOW, prices });
    await registerVertexResources([regional], dependencies);
    assert.equal(outputPrice(registered[0][1], "gemini-4-argon"), 22);
    assert.equal(registered[0][1].streamSimple({}, {}).env.GOOGLE_CLOUD_LOCATION, "us-central1");
  });

  it("discovers with the resolved token and the resource project", async () => {
    const listed: GoogleCredentials[] = [];
    const resolved: string[] = [];
    const { dependencies } = harness(undefined, {
      resolveToken: (value) => {
        resolved.push(value);
        return "token";
      },
      listModels: async (credentials) => {
        listed.push(credentials);
        return [];
      },
    });
    await registerVertexResources([RESOURCE], dependencies);
    assert.deepEqual(resolved, ["!print-token"]);
    assert.deepEqual(listed, [{ accessToken: "token", project: "acme-project" }]);
  });

  it("uses fresh cached prices, skips models quietly, and does not refresh", async () => {
    const { dependencies, registered, logs, priceRequests } = harness({ fetchedAt: NOW - 1, prices: CACHED_PRICES });
    const { refreshed } = await registerVertexResources([RESOURCE], dependencies);
    await refreshed;
    assert.equal(registered.length, 1);
    assert.deepEqual(modelIds(registered[0][1]), ["gemini-4-argon", "gemini-4-carbon"]);
    assert.equal(outputPrice(registered[0][1], "gemini-4-carbon"), 20);
    assert.deepEqual(logs, []);
    assert.equal(priceRequests.length, 0);
  });

  it("registers with stale prices first, then saves and re-registers with fresh prices", async () => {
    const { dependencies, registered, saved } = harness({ fetchedAt: NOW - PRICE_REFRESH_AGE_MS, prices: CACHED_PRICES });
    const { refreshed } = await registerVertexResources([RESOURCE], dependencies);
    assert.equal(registered.length, 1);
    assert.equal(outputPrice(registered[0][1], "gemini-4-argon"), 20);

    await refreshed;
    assert.deepEqual(saved, [{ fetchedAt: NOW, prices: FRESH_PRICES }]);
    assert.equal(registered.length, 2);
    assert.equal(outputPrice(registered[1][1], "gemini-4-argon"), 21);
  });

  it("does not wait for the price refresh before returning", async () => {
    let finishFetch!: (prices: PriceTable) => void;
    const { dependencies, registered } = harness(undefined, {
      fetchPrices: () => new Promise((resolve) => (finishFetch = resolve)),
    });
    const { refreshed } = await registerVertexResources([RESOURCE], dependencies);
    assert.equal(registered.length, 1);
    finishFetch(FRESH_PRICES);
    await refreshed;
    assert.equal(registered.length, 2);
  });

  it("keeps every catalog-backed model with catalog prices when there is no cache", async () => {
    const { dependencies, registered } = harness(undefined);
    const { refreshed } = await registerVertexResources([RESOURCE], dependencies);
    assert.deepEqual(modelIds(registered[0][1]), ["gemini-4-argon", "gemini-4-carbon", "gemini-4-tts"]);
    assert.equal(outputPrice(registered[0][1], "gemini-4-argon"), 10);

    await refreshed;
    assert.deepEqual(modelIds(registered[1][1]), ["gemini-4-argon", "gemini-4-carbon"]);
  });

  it("refreshes once for several resources and re-registers each of them", async () => {
    const other = { ...RESOURCE, provider: "other-vertex", project: "other-project" };
    const { dependencies, registered, priceRequests } = harness(undefined);
    const { refreshed } = await registerVertexResources([RESOURCE, other], dependencies);
    await refreshed;
    assert.deepEqual(priceRequests, [{ accessToken: "token", project: "acme-project" }]);
    assert.deepEqual(registered.map(([id]) => id), ["acme-vertex", "other-vertex", "acme-vertex", "other-vertex"]);
    assert.equal(registered[3][1].streamSimple({}, {}).env.GOOGLE_CLOUD_PROJECT, "other-project");
  });

  it("logs a failed refresh and keeps the startup registration", async () => {
    const { dependencies, registered, logs, saved } = harness(undefined, {
      fetchPrices: async () => {
        throw new Error("403 billing denied");
      },
    });
    const { refreshed } = await registerVertexResources([RESOURCE], dependencies);
    await assert.doesNotReject(refreshed);
    assert.equal(registered.length, 1);
    assert.equal(saved.length, 0);
    assert.match(logs.at(-1)!, /Vertex price refresh failed: .*403 billing denied/);
  });

  it("skips a resource whose token is not set and does not refresh", async () => {
    const { dependencies, registered, logs, priceRequests } = harness(undefined, { resolveToken: () => undefined });
    const { refreshed } = await registerVertexResources([RESOURCE], dependencies);
    await refreshed;
    assert.equal(registered.length, 0);
    assert.equal(priceRequests.length, 0);
    assert.match(logs[0], /access token is not set/);
  });

  it("logs and skips a resource whose discovery fails", async () => {
    const { dependencies, registered, logs } = harness(undefined, {
      listModels: async () => {
        throw new Error("401 denied");
      },
    });
    await assert.doesNotReject(registerVertexResources([RESOURCE], dependencies));
    assert.equal(registered.length, 0);
    assert.match(logs[0], /discovery failed: .*401 denied/);
  });

  it("logs and skips a resource whose token command fails", async () => {
    const { dependencies, registered, logs } = harness(undefined, {
      resolveToken: () => {
        throw new Error("gcloud exited 1");
      },
    });
    await registerVertexResources([RESOURCE], dependencies);
    assert.equal(registered.length, 0);
    assert.match(logs[0], /discovery failed: .*gcloud exited 1/);
  });
});
