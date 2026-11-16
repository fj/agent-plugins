import { execSync } from "node:child_process";

export interface FoundryResourceConfig {
  type?: "foundry";
  provider: string;
  name: string;
  endpoint: string;
  apiKey: string;
}

export interface VertexResourceConfig {
  type: "vertex";
  provider: string;
  name: string;
  project: string;
  location: string;
  accessToken: string;
}

export type ResourceConfig = FoundryResourceConfig | VertexResourceConfig;

const DEFAULT_VERTEX_LOCATION = "global";
const DEFAULT_VERTEX_ACCESS_TOKEN = "!gcloud auth application-default print-access-token";

const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const LOCATION_PATTERN = /^[a-z0-9-]+$/;
const ENV_REFERENCE_PATTERN = /\$\$|\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)/g;

export function parseConfig(text: string): ResourceConfig[] {
  const { resources } = JSON.parse(text);
  if (!Array.isArray(resources)) throw new Error("`resources` must be an array");
  return resources.map(parseResource);
}

function parseResource(raw: any, index: number): ResourceConfig {
  const where = `resources[${index}]`;
  if (typeof raw?.provider !== "string" || !PROVIDER_ID_PATTERN.test(raw.provider)) {
    throw new Error(`${where}.provider must match ${PROVIDER_ID_PATTERN}`);
  }
  if (raw.type === "vertex") return parseVertexResource(raw, where);
  if (raw.type !== undefined && raw.type !== "foundry") {
    throw new Error(`${where}.type must be "foundry" or "vertex"`);
  }
  return parseFoundryResource(raw, where);
}

function parseFoundryResource(raw: any, where: string): FoundryResourceConfig {
  if (typeof raw.endpoint !== "string" || !raw.endpoint.startsWith("https://")) {
    throw new Error(`${where}.endpoint must be an https:// URL`);
  }
  if (typeof raw.apiKey !== "string" || raw.apiKey === "") {
    throw new Error(`${where}.apiKey must be a non-empty string`);
  }
  return {
    ...(raw.type === undefined ? {} : { type: raw.type }),
    provider: raw.provider,
    name: typeof raw.name === "string" ? raw.name : raw.provider,
    endpoint: raw.endpoint.replace(/\/+$/, ""),
    apiKey: raw.apiKey,
  };
}

function parseVertexResource(raw: any, where: string): VertexResourceConfig {
  if (typeof raw.project !== "string" || raw.project === "") {
    throw new Error(`${where}.project must be a non-empty string`);
  }
  const location = raw.location ?? DEFAULT_VERTEX_LOCATION;
  if (typeof location !== "string" || !LOCATION_PATTERN.test(location)) {
    throw new Error(`${where}.location must match ${LOCATION_PATTERN}`);
  }
  const accessToken = raw.accessToken ?? DEFAULT_VERTEX_ACCESS_TOKEN;
  if (typeof accessToken !== "string" || accessToken === "") {
    throw new Error(`${where}.accessToken must be a non-empty string`);
  }
  return {
    type: "vertex",
    provider: raw.provider,
    name: typeof raw.name === "string" ? raw.name : raw.provider,
    project: raw.project,
    location,
    accessToken,
  };
}

export type CommandRunner = (command: string) => string;

const runShell: CommandRunner = (command) => execSync(command, { encoding: "utf8" });

/** Resolves an API key value the way pi does: `!command`, `$VAR` / `${VAR}` interpolation, or a literal. */
export function resolveSecret(
  value: string,
  env: Record<string, string | undefined> = process.env,
  run: CommandRunner = runShell,
): string | undefined {
  if (value.startsWith("!")) return run(value.slice(1)).trim() || undefined;

  let missing = false;
  const resolved = value.replace(ENV_REFERENCE_PATTERN, (match, braced, bare) => {
    if (match === "$$") return "$";
    const found = env[braced ?? bare];
    if (found === undefined || found === "") missing = true;
    return found ?? "";
  });
  return missing || resolved === "" ? undefined : resolved;
}
