import { cp, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

const TEMPLATE = "manifest.json";
const COPIED_FILES = ["README.md", "LICENSE"];
const MANIFEST_FIELDS = ["name", "version", "description", "author"];
const REPOSITORY = "https://github.com/fj/agent-plugins";
const JSON_INDENT = 2;

const ROOT = join(import.meta.dirname, "..");

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, "utf8"));
}

function pick(source: Record<string, unknown>, fields: string[]): Record<string, unknown> {
  return Object.fromEntries(fields.filter((field) => field in source).map((field) => [field, source[field]]));
}

export async function buildPiPackage(out: string, version: string, root = ROOT): Promise<void> {
  const plugin = await readJson(join(root, "agent-plugin.json"));
  const template = await readJson(join(root, "src", "adapters", "pi", TEMPLATE));
  const manifest = {
    ...pick({ ...plugin, version }, MANIFEST_FIELDS),
    repository: REPOSITORY,
    type: "module",
    ...template,
  };

  await rm(join(out, "src"), { recursive: true, force: true });
  await cp(join(root, "src"), join(out, "src"), {
    recursive: true,
    filter: (path) => basename(path) !== TEMPLATE,
  });
  for (const file of COPIED_FILES) await cp(join(root, file), join(out, file));
  await writeFile(join(out, "package.json"), `${JSON.stringify(manifest, null, JSON_INDENT)}\n`);
}
