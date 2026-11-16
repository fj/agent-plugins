import type { FetchOptions } from "../http.ts";
import { fetchAllPages, type GoogleCredentials } from "./google-api.ts";

const GARDEN_URL =
  "https://us-central1-aiplatform.googleapis.com/v1beta1/publishers/google/models?pageSize=300&listAllVersions=true";
const PUBLISHER_PATH = "publishers/google/models/";
const GEMINI_MODEL_PREFIX = `${PUBLISHER_PATH}gemini-`;

/** Lists the ids of the Gemini models in the Vertex AI Model Garden. */
export async function fetchGeminiModels(credentials: GoogleCredentials, options?: FetchOptions): Promise<string[]> {
  const models = await fetchAllPages<{ name: string }>(GARDEN_URL, "publisherModels", credentials, options);
  const ids = models
    .map((model) => model.name)
    .filter((name) => name.startsWith(GEMINI_MODEL_PREFIX))
    .map((name) => name.slice(PUBLISHER_PATH.length));
  return [...new Set(ids)];
}
