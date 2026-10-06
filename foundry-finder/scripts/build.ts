import { isAbsolute } from "node:path";
import { parseArgs } from "node:util";
import { buildPiPackage } from "./pi-package.ts";

const SUPPORTED_HARNESS = "pi";
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

const { values } = parseArgs({
  options: {
    harness: { type: "string" },
    out: { type: "string" },
    version: { type: "string" },
  },
});

function fail(message: string): never {
  console.error(`build: ${message}`);
  process.exit(1);
}

if (values.harness !== SUPPORTED_HARNESS) fail(`unsupported harness: ${values.harness}`);
if (!values.out || !isAbsolute(values.out)) fail("--out must be an absolute path");
if (!values.version || !VERSION_PATTERN.test(values.version)) fail("--version must be x.y.t");

await buildPiPackage(values.out, values.version);
