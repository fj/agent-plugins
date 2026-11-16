import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseConfig, resolveSecret } from "../src/config.ts";

const resource = {
  provider: "acme-foundry",
  name: "Acme Foundry",
  endpoint: "https://acme.services.ai.azure.com/",
  apiKey: "$ACME_KEY",
};

describe("parseConfig", () => {
  it("normalizes the endpoint and keeps the other fields", () => {
    assert.deepEqual(parseConfig(JSON.stringify({ resources: [resource] })), [
      { ...resource, endpoint: "https://acme.services.ai.azure.com" },
    ]);
  });

  it("defaults the display name to the provider id", () => {
    const { name, ...unnamed } = resource;
    assert.equal(parseConfig(JSON.stringify({ resources: [unnamed] }))[0].name, "acme-foundry");
  });

  it("rejects a missing resources array", () => {
    assert.throws(() => parseConfig("{}"), /resources/);
  });

  it("rejects an invalid provider id", () => {
    const bad = { resources: [{ ...resource, provider: "Acme Foundry" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.provider/);
  });

  it("rejects a non-https endpoint", () => {
    const bad = { resources: [{ ...resource, endpoint: "http://acme" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.endpoint/);
  });

  it("rejects an empty API key", () => {
    const bad = { resources: [{ ...resource, apiKey: "" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.apiKey/);
  });

  it("accepts an explicit foundry type", () => {
    const [parsed] = parseConfig(JSON.stringify({ resources: [{ ...resource, type: "foundry" }] }));
    assert.equal(parsed.type, "foundry");
  });

  it("rejects an unknown type", () => {
    const bad = { resources: [{ ...resource, type: "bedrock" }] };
    assert.throws(() => parseConfig(JSON.stringify(bad)), /resources\[0\]\.type/);
  });
});

describe("parseConfig for Vertex resources", () => {
  const vertex = { type: "vertex", provider: "acme-vertex", project: "acme-project" };

  function parseOne(raw: Record<string, unknown>) {
    return parseConfig(JSON.stringify({ resources: [raw] }))[0];
  }

  it("defaults the name, location, and access token without Foundry fields", () => {
    assert.deepEqual(parseOne(vertex), {
      type: "vertex",
      provider: "acme-vertex",
      name: "acme-vertex",
      project: "acme-project",
      location: "global",
      accessToken: "!gcloud auth application-default print-access-token",
    });
  });

  it("keeps a configured name, location, and access token", () => {
    const configured = { ...vertex, name: "Acme", location: "us-central1", accessToken: "$TOKEN" };
    assert.deepEqual(parseOne(configured), configured);
  });

  it("rejects a missing project", () => {
    const { project, ...bad } = vertex;
    assert.throws(() => parseOne(bad), /resources\[0\]\.project/);
  });

  it("rejects an invalid location", () => {
    assert.throws(() => parseOne({ ...vertex, location: "https://us-central1" }), /resources\[0\]\.location/);
  });

  it("rejects an empty access token", () => {
    assert.throws(() => parseOne({ ...vertex, accessToken: "" }), /resources\[0\]\.accessToken/);
  });

  it("rejects an invalid provider id", () => {
    assert.throws(() => parseOne({ ...vertex, provider: "Acme Vertex" }), /resources\[0\]\.provider/);
  });
});

describe("resolveSecret", () => {
  const env = { KEY: "secret", PREFIX: "sk" };
  const noCommands = () => assert.fail("no command expected");

  it("returns literals unchanged", () => {
    assert.equal(resolveSecret("literal", env, noCommands), "literal");
  });

  it("interpolates bare and braced variables", () => {
    assert.equal(resolveSecret("$KEY", env, noCommands), "secret");
    assert.equal(resolveSecret("${PREFIX}_$KEY", env, noCommands), "sk_secret");
  });

  it("treats $$ as a literal dollar sign", () => {
    assert.equal(resolveSecret("$$KEY", env, noCommands), "$KEY");
  });

  it("is unresolved when a referenced variable is missing or empty", () => {
    assert.equal(resolveSecret("$ABSENT", env, noCommands), undefined);
    assert.equal(resolveSecret("$EMPTY", { EMPTY: "" }, noCommands), undefined);
  });

  it("runs ! values as commands and trims their output", () => {
    assert.equal(resolveSecret("!echo hi", env, (command) => `${command} ran\n`), "echo hi ran");
  });

  it("is unresolved when a command prints nothing", () => {
    assert.equal(resolveSecret("!true", env, () => "\n"), undefined);
  });
});
