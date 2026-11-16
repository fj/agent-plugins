import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fetchGeminiModels } from "../src/vertex/discovery.ts";
import { fetchAllPages } from "../src/vertex/google-api.ts";

const CREDENTIALS = { accessToken: "token", project: "acme-project" };
const LIST_URL = "https://example.googleapis.com/v1/items?pageSize=2";

function pagedFetch(pages: Record<string, unknown>[], requests: Request[] = []): typeof fetch {
  return async (input, init) => {
    requests.push(new Request(input, init));
    return new Response(JSON.stringify(pages[requests.length - 1]), { status: 200 });
  };
}

describe("fetchAllPages", () => {
  it("sends the bearer token and quota project", async () => {
    const requests: Request[] = [];
    await fetchAllPages(LIST_URL, "items", CREDENTIALS, { fetch: pagedFetch([{ items: [] }], requests) });
    assert.equal(requests[0].headers.get("authorization"), "Bearer token");
    assert.equal(requests[0].headers.get("x-goog-user-project"), "acme-project");
  });

  it("follows page tokens and concatenates the items", async () => {
    const requests: Request[] = [];
    const fetch = pagedFetch([{ items: [1, 2], nextPageToken: "next" }, { items: [3], nextPageToken: "" }], requests);
    assert.deepEqual(await fetchAllPages(LIST_URL, "items", CREDENTIALS, { fetch }), [1, 2, 3]);
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, LIST_URL);
    assert.equal(new URL(requests[1].url).searchParams.get("pageToken"), "next");
    assert.equal(new URL(requests[1].url).searchParams.get("pageSize"), "2");
  });

  it("treats a page without the field as empty", async () => {
    assert.deepEqual(await fetchAllPages(LIST_URL, "items", CREDENTIALS, { fetch: pagedFetch([{}]) }), []);
  });

  it("throws with the status and body on an error response", async () => {
    const fetch: typeof globalThis.fetch = async () => new Response("denied", { status: 403 });
    await assert.rejects(fetchAllPages(LIST_URL, "items", CREDENTIALS, { fetch }), /403 denied/);
  });

  it("aborts a request that exceeds the timeout", async () => {
    const hang: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)));
    await assert.rejects(fetchAllPages(LIST_URL, "items", CREDENTIALS, { fetch: hang, timeoutMs: 1 }), /TimeoutError|timed out/i);
  });
});

describe("fetchGeminiModels", () => {
  it("lists Google publisher models from the Model Garden", async () => {
    const requests: Request[] = [];
    await fetchGeminiModels(CREDENTIALS, { fetch: pagedFetch([{ publisherModels: [] }], requests) });
    const url = new URL(requests[0].url);
    assert.equal(url.origin + url.pathname, "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models");
    assert.equal(url.searchParams.get("listAllVersions"), "true");
  });

  it("returns unique Gemini model ids only", async () => {
    const publisherModels = [
      { name: "publishers/google/models/gemini-4-argon" },
      { name: "publishers/google/models/gemini-4-argon" },
      { name: "publishers/google/models/imagen-4" },
      { name: "publishers/google/models/gemini-2.5-pro-tts" },
    ];
    const ids = await fetchGeminiModels(CREDENTIALS, { fetch: pagedFetch([{ publisherModels }]) });
    assert.deepEqual(ids, ["gemini-4-argon", "gemini-2.5-pro-tts"]);
  });
});
