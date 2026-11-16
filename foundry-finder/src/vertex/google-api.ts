import { DEFAULT_TIMEOUT_MS, type FetchOptions } from "../http.ts";

export interface GoogleCredentials {
  accessToken: string;
  project: string;
}

/** Fetches every page of a Google list API and concatenates the items under `field`. */
export async function fetchAllPages<T>(
  url: string,
  field: string,
  { accessToken, project }: GoogleCredentials,
  { fetch = globalThis.fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: FetchOptions = {},
): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  do {
    const page = new URL(url);
    if (pageToken) page.searchParams.set("pageToken", pageToken);
    const response = await fetch(page, {
      headers: { Authorization: `Bearer ${accessToken}`, "x-goog-user-project": project },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
    const body = (await response.json()) as Record<string, unknown>;
    items.push(...((body[field] as T[] | undefined) ?? []));
    pageToken = (body.nextPageToken as string | undefined) || undefined;
  } while (pageToken);
  return items;
}
