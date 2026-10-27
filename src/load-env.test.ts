import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { findMonorepoRoot, loadGeneratedEnv } from "./index";

const savedEnv = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
});

describe("findMonorepoRoot", () => {
  it("walks up to a directory with turbo.json", () => {
    const root = mkdtempSync(join(tmpdir(), "reasked-env-root-"));
    writeFileSync(join(root, "turbo.json"), "{}");
    const appDir = join(root, "apps", "api");
    mkdirSync(appDir, { recursive: true });

    expect(findMonorepoRoot(appDir)).toBe(root);
  });
});

describe("loadGeneratedEnv", () => {
  it("loads only the directory .env", () => {
    const root = mkdtempSync(join(tmpdir(), "reasked-env-load-"));
    writeFileSync(join(root, "pnpm-workspace.yaml"), "packages: []\n");
    writeFileSync(join(root, ".env"), "FROM_ROOT=1\nSHARED=root\n");
    const appDir = join(root, "apps", "api");
    mkdirSync(appDir, { recursive: true });
    writeFileSync(join(appDir, ".env"), "SHARED=app\nONLY_APP=1\n");

    delete process.env.FROM_ROOT;
    delete process.env.SHARED;
    delete process.env.ONLY_APP;

    loadGeneratedEnv({ dir: appDir });

    expect(process.env.SHARED).toBe("app");
    expect(process.env.ONLY_APP).toBe("1");
    expect(process.env.FROM_ROOT).toBeUndefined();
  });
});
