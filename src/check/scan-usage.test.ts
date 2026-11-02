import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { collectUsedEnvKeys, extractEnvKeysFromSource } from "./scan-usage";

describe("extractEnvKeysFromSource", () => {
  it("finds process.env dot and bracket access", () => {
    const keys = extractEnvKeysFromSource(`
      const a = process.env.NODE_ENV;
      const b = process.env["DATABASE_URL"];
      const c = process.env['SMTP_HOST'];
    `);
    expect([...keys].sort()).toEqual(["DATABASE_URL", "NODE_ENV", "SMTP_HOST"]);
  });

  it("finds import.meta.env but skips Vite builtins", () => {
    const keys = extractEnvKeysFromSource(`
      const a = import.meta.env.VITE_API_URL;
      const b = import.meta.env.MODE;
      const c = import.meta.env.DEV;
    `);
    expect([...keys]).toEqual(["VITE_API_URL"]);
  });

  it.each(["MODE", "DEV", "PROD", "SSR", "BASE_URL"])(
    "only excludes Vite builtin %s from import.meta.env",
    key => {
      for (const access of [`.${key}`, `["${key}"]`, `['${key}']`]) {
        expect([...extractEnvKeysFromSource(`process.env${access};`)]).toEqual([key]);
        expect([...extractEnvKeysFromSource(`import.meta.env${access};`)]).toEqual([]);
      }
    }
  );

  it("ignores dynamic access", () => {
    const keys = extractEnvKeysFromSource(`const x = process.env[name];`);
    expect(keys.size).toBe(0);
  });
});

describe("collectUsedEnvKeys", () => {
  it("skips tests/ by default but includes them with includeTests", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-scan-"));
    mkdirSync(join(root, "src"), { recursive: true });
    mkdirSync(join(root, "tests"), { recursive: true });
    writeFileSync(join(root, "src/index.ts"), `process.env.RUNTIME_KEY;\n`);
    writeFileSync(join(root, "tests/setup.ts"), `process.env.TEST_ONLY_KEY;\n`);

    const runtime = collectUsedEnvKeys(root);
    expect([...runtime.keys].sort()).toEqual(["RUNTIME_KEY"]);

    const withTests = collectUsedEnvKeys(root, { includeTests: true });
    expect([...withTests.keys].sort()).toEqual(["RUNTIME_KEY", "TEST_ONLY_KEY"]);
  });
});
