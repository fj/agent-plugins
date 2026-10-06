import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

const BUILD = join(import.meta.dirname, "..", "scripts", "build.ts");
const VERSION = "0.1.20261005120000";
const FAILURE = 1;

function build(...args: string[]) {
  return spawnSync(process.execPath, [BUILD, ...args], { encoding: "utf8" });
}

describe("build.ts", () => {
  let out: string;

  before(async () => {
    out = await mkdtemp(join(tmpdir(), "foundry-finder-cli-"));
  });

  after(() => rm(out, { recursive: true, force: true }));

  it("builds the Pi package", () => {
    const result = build("--harness", "pi", "--out", out, "--version", VERSION);
    assert.equal(result.status, 0, result.stderr);
    assert.ok(existsSync(join(out, "package.json")));
  });

  const rejected: [string, string[], RegExp][] = [
    ["another harness", ["--harness", "claude", "--out", "/unused", "--version", VERSION], /unsupported harness/],
    ["a relative --out", ["--harness", "pi", "--out", "relative", "--version", VERSION], /--out/],
    ["a missing --out", ["--harness", "pi", "--version", VERSION], /--out/],
    ["a major.minor --version", ["--harness", "pi", "--out", "/unused", "--version", "0.1"], /--version/],
    ["a prefixed --version", ["--harness", "pi", "--out", "/unused", "--version", `v${VERSION}`], /--version/],
  ];

  for (const [name, args, message] of rejected) {
    it(`rejects ${name}`, () => {
      const result = build(...args);
      assert.equal(result.status, FAILURE);
      assert.match(result.stderr, /^build: /);
      assert.match(result.stderr, message);
    });
  }
});
