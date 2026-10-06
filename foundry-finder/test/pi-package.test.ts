import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { buildPiPackage } from "../scripts/pi-package.ts";

const ROOT = join(import.meta.dirname, "..");

const VERSION = "0.1.20261005120000";
const STALE_FILE = "removed.ts";

describe("buildPiPackage", () => {
  let out: string;

  before(async () => {
    out = await mkdtemp(join(tmpdir(), "foundry-finder-build-"));
    await mkdir(join(out, "src"));
    await writeFile(join(out, "src", STALE_FILE), "");
    await buildPiPackage(out, VERSION);
  });

  after(() => rm(out, { recursive: true, force: true }));

  it("writes a Pi manifest from agent-plugin.json and the adapter template", async () => {
    const manifest = JSON.parse(await readFile(join(out, "package.json"), "utf8"));
    const plugin = JSON.parse(await readFile(join(ROOT, "agent-plugin.json"), "utf8"));
    assert.equal(manifest.name, plugin.name);
    assert.equal(manifest.version, VERSION);
    assert.equal(manifest.description, plugin.description);
    assert.deepEqual(manifest.author, plugin.author);
    assert.equal(manifest.repository, "https://github.com/fj/agent-plugins");
    assert.equal(manifest.type, "module");
    assert.equal(manifest.license, "MIT");
    assert.deepEqual(manifest.keywords, ["pi-package"]);
    assert.deepEqual(manifest.pi, { extensions: ["./src/adapters/pi"] });
    assert.ok("@earendil-works/pi-coding-agent" in manifest.peerDependencies);
  });

  it("copies the sources, README and LICENSE", () => {
    for (const path of ["src/adapters/pi/index.ts", "src/register.ts", "README.md", "LICENSE"]) {
      assert.ok(existsSync(join(out, path)), path);
    }
  });

  it("leaves the manifest template out of the package", () => {
    assert.equal(existsSync(join(out, "src/adapters/pi/manifest.json")), false);
  });

  it("removes sources left from an earlier build", () => {
    assert.equal(existsSync(join(out, "src", STALE_FILE)), false);
  });
});
