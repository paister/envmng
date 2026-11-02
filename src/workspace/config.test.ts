import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { clearActiveEnvIf, ENVMNG_CONFIG_FILE, readActiveEnv, writeActiveEnv } from "./config";

describe("envmng config", () => {
  it("writes ENV= as dotenv and reads it back", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-cfg-"));
    writeActiveEnv(root, "local");
    expect(readActiveEnv(root)).toBe("local");
    const text = readFileSync(join(root, ENVMNG_CONFIG_FILE), "utf8");
    expect(text).toContain("ENV=local");
    expect(text).toMatch(/^# Managed by envmng/m);
  });

  it("preserves other keys on upsert", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-cfg-keep-"));
    writeFileSync(join(root, ENVMNG_CONFIG_FILE), "# keep\nFOO=bar\nENV=prev\n");
    writeActiveEnv(root, "prod");
    const text = readFileSync(join(root, ENVMNG_CONFIG_FILE), "utf8");
    expect(text).toContain("FOO=bar");
    expect(text).toContain("ENV=prod");
    expect(text).not.toContain("ENV=prev");
    expect(readActiveEnv(root)).toBe("prod");
  });

  it("clears ENV and deletes empty config", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-cfg-clear-"));
    writeActiveEnv(root, "scratch");
    expect(clearActiveEnvIf(root, "other")).toBe(false);
    expect(existsSync(join(root, ENVMNG_CONFIG_FILE))).toBe(true);
    expect(clearActiveEnvIf(root, "scratch")).toBe(true);
    expect(existsSync(join(root, ENVMNG_CONFIG_FILE))).toBe(false);
  });

  it("clears ENV but keeps file when other keys remain", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-cfg-partial-"));
    writeFileSync(join(root, ENVMNG_CONFIG_FILE), "FOO=1\nENV=local\n");
    expect(clearActiveEnvIf(root, "local")).toBe(true);
    expect(existsSync(join(root, ENVMNG_CONFIG_FILE))).toBe(true);
    expect(readFileSync(join(root, ENVMNG_CONFIG_FILE), "utf8")).toContain("FOO=1");
    expect(readActiveEnv(root)).toBeNull();
  });
});
