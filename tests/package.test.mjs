import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

const run = (label, command, args, cwd, env, timeout = 15_000) => {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  // npm output can contain registry credentials; report process metadata instead.
  assert.ok(
    !result.error && result.status === 0,
    `${label} failed (exit=${result.status}, signal=${result.signal ?? "none"}, error=${result.error?.code ?? "none"}, timeout=${timeout}ms); subprocess output omitted to protect credentials.`,
  );
  return result.stdout;
};

// The caller builds first; pack must not invoke prepack or test hooks recursively.
test("the real npm tarball installs and exposes a working CLI and library", { timeout: 300_000 }, (t) => {
  const temp = mkdtempSync(join(tmpdir(), "envmng-package-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const consumer = join(temp, "consumer");
  const cache = join(temp, "npm-cache");
  mkdirSync(consumer);
  const env = { ...process.env };
  // Test normal Node resolution, without inherited preload hooks or fallback paths.
  delete env.NODE_OPTIONS;
  delete env.NODE_PATH;

  const packOutput = run("npm pack", "npm", ["pack", "--ignore-scripts", "--json", "--pack-destination", temp, "--cache", cache], projectRoot, env, 60_000);
  let packages;
  try {
    packages = JSON.parse(packOutput);
  } catch {
    assert.fail("npm pack did not return valid JSON (output omitted to protect credentials)");
  }
  assert.equal(packages.length, 1, "npm pack must produce exactly one package");
  const packed = packages[0];
  assert.equal(packed.name, "envmng");
  assert.ok(packed.filename && !/[\\/]/.test(packed.filename), "expected a tarball filename");
  const files = new Map(packed.files.map((file) => [file.path, file]));
  for (const path of ["package.json", "README.md", "dist/envmng.mjs", "dist/index.mjs", "dist/index.d.mts"]) {
    assert.ok(files.has(path), `tarball is missing ${path}`);
  }
  assert.ok(
    [...files.keys()].some((path) => /^docs\/.+\.md$/.test(path)),
    "tarball must include documentation",
  );
  assert.equal(files.get("dist/envmng.mjs").mode & 0o111, 0o111, "packed CLI must be executable");
  for (const path of files.keys()) {
    const segments = path.split("/");
    assert.ok(!segments.some((segment) => ["src", "tests", "node_modules"].includes(segment)), `tarball includes a development-only path: ${path}`);
    assert.ok(
      !segments.some((segment) => /^\.env(?:\.|$)/i.test(segment) || /\.env$/i.test(segment) || [".npmrc", ".netrc"].includes(segment)),
      `tarball includes an environment or credentials file: ${path}`,
    );
  }

  writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "envmng-package-consumer", private: true }));
  run(
    "install packed envmng into the consumer repository",
    "npm",
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false", "--cache", cache, join(temp, packed.filename)],
    consumer,
    env,
    120_000,
  );

  const bin = join(consumer, "node_modules", ".bin", "envmng");
  assert.match(run("installed CLI --help", bin, ["--help"], consumer, env), /envmng <command>/);
  writeFileSync(join(consumer, "pnpm-workspace.yaml"), "packages: []\n");
  writeFileSync(join(consumer, ".env.example"), "PACKAGE_TEST_VALUE=sample\n");
  run("installed CLI create local", bin, ["create", "local"], consumer, env);
  assert.equal(readFileSync(join(consumer, ".local.env"), "utf8"), "PACKAGE_TEST_VALUE=sample\n");
  run("installed CLI set local", bin, ["set", "local"], consumer, env);
  assert.match(readFileSync(join(consumer, ".env"), "utf8"), /^PACKAGE_TEST_VALUE=sample$/m);

  run(
    "import and exercise public library exports from the installed package",
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `
      import assert from "node:assert/strict";
      const { renderTemplate, parseEnvFile } = await import("envmng");
      const values = parseEnvFile("PACKAGE_TEST_VALUE=sample\\n");
      assert.ok(values instanceof Map);
      assert.equal(values.get("PACKAGE_TEST_VALUE"), "sample");
      assert.deepEqual(renderTemplate("VALUE={{PACKAGE_TEST_VALUE}}\\n", values), {
        text: "VALUE=sample\\n",
        missing: [],
      });
      assert.deepEqual(renderTemplate("{{MISSING}}", values), { text: "", missing: ["MISSING"] });
    `,
    ],
    consumer,
    env,
  );
});
