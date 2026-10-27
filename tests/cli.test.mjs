import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const cli = fileURLToPath(new URL(`../${packageJson.bin.envmng}`, import.meta.url));

const run = (cwd, ...args) => {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd,
    encoding: "utf8",
    timeout: 10_000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout;
};

const fixture = (t) => {
  const root = mkdtempSync(join(tmpdir(), "envmng-cli-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
};

test("the packaged binary has a Node shebang and provides help outside its checkout", (t) => {
  assert.ok(readFileSync(cli, "utf8").startsWith("#!/usr/bin/env node\n"));
  assert.match(run(fixture(t), "--help"), /envmng <command>/);
});

test("creates profiles in the working directory when no root marker exists", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".env.example"), "CLI_TEST_VALUE=sample\n");

  run(root, "create", "local");

  assert.equal(readFileSync(join(root, ".local.env"), "utf8"), "CLI_TEST_VALUE=sample\n");
});

test("add prod declares an empty example key without activating or exposing its value", (t) => {
  const root = fixture(t);
  writeFileSync(join(root, ".env.example"), "PORT=3000\n");
  writeFileSync(join(root, ".env"), "PORT=3000\n");
  writeFileSync(join(root, ".envmng"), "ENV=local\n");

  const output = run(root, "add", "prod", "--key", "API_TOKEN", "--value", "fake-cli-secret");

  assert.equal(readFileSync(join(root, ".env.example"), "utf8"), "PORT=3000\n\nAPI_TOKEN=\n");
  assert.equal(readFileSync(join(root, ".prod.env"), "utf8"), "API_TOKEN=fake-cli-secret\n");
  assert.equal(readFileSync(join(root, ".env"), "utf8"), "PORT=3000\n");
  assert.equal(readFileSync(join(root, ".envmng"), "utf8"), "ENV=local\n");
  assert.doesNotMatch(output, /fake-cli-secret/);
  assert.match(output, /envmng check prod && envmng set prod/);
});

for (const marker of ["pnpm-workspace.yaml", "turbo.json"]) {
  test(`finds the target repository from a nested working directory using ${marker}`, (t) => {
    const root = fixture(t);
    const consumer = join(root, "apps", "api");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(root, marker), marker.endsWith(".json") ? "{}\n" : "packages: []\n");
    writeFileSync(join(root, ".env.example"), "CLI_TEST_VALUE=sample\n");
    writeFileSync(join(consumer, ".env.example"), "CLI_TEST_VALUE={{CLI_TEST_VALUE}}\n");

    run(consumer, "create", "local");
    run(consumer, "set", "local");

    assert.equal(readFileSync(join(root, ".local.env"), "utf8"), "CLI_TEST_VALUE=sample\n");
    assert.match(readFileSync(join(root, ".env"), "utf8"), /^CLI_TEST_VALUE=sample$/m);
    assert.match(readFileSync(join(consumer, ".env"), "utf8"), /^CLI_TEST_VALUE=sample$/m);
  });
}
