import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { parseEnvFile } from "../parse";
import { addEnvKey } from "./add";

const roots: string[] = [];
const fixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), "envmng-add-"));
  roots.push(root);
  return root;
};

const read = (root: string, file: string): string => readFileSync(join(root, file), "utf8");

const value = (root: string, file: string, key: string): string | undefined => parseEnvFile(read(root, file)).get(key);

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("addEnvKey", () => {
  it("declares new keys with empty example values and keeps the real value in the profile", async () => {
    const root = fixture();
    writeFileSync(join(root, ".env.example"), "PORT=3000\n");

    await addEnvKey({ root, name: "local", key: "API_TOKEN", value: "fake-runtime-secret", syncProfiles: false });

    expect(read(root, ".env.example")).toBe("PORT=3000\n\nAPI_TOKEN=\n");
    expect(value(root, ".local.env", "API_TOKEN")).toBe("fake-runtime-secret");
    expect(existsSync(join(root, ".env"))).toBe(false);
    expect(existsSync(join(root, ".envmng"))).toBe(false);
  });

  it("syncs values only to missing keys in other root profiles when explicitly requested", async () => {
    const root = fixture();
    mkdirSync(join(root, "apps", "workers"), { recursive: true });
    writeFileSync(join(root, ".env.example"), "DATABASE_URL=postgres://sample\n");
    writeFileSync(join(root, ".local.env"), "DATABASE_URL=postgres://local\n");
    writeFileSync(join(root, ".prod.env"), "DATABASE_URL=postgres://prod\n");
    writeFileSync(join(root, ".staging.env"), "NODE_ENV=staging\n");
    const template = "DATABASE_URL={{DATABASE_URL}}\n";
    writeFileSync(join(root, "apps/workers/.env.example"), template);
    writeFileSync(join(root, "apps/workers/.local.env"), template);

    await addEnvKey({ root, name: "local", key: "NODE_ENV", value: "development", syncProfiles: true });

    expect(value(root, ".env.example", "NODE_ENV")).toBe("");
    expect(value(root, ".local.env", "NODE_ENV")).toBe("development");
    expect(value(root, ".prod.env", "NODE_ENV")).toBe("development");
    expect(value(root, ".staging.env", "NODE_ENV")).toBe("staging");
    expect(read(root, "apps/workers/.env.example")).toBe(template);
    expect(read(root, "apps/workers/.local.env")).toBe(template);
    expect(existsSync(join(root, "apps/workers/.env"))).toBe(false);
    expect(existsSync(join(root, ".env"))).toBe(false);
    expect(existsSync(join(root, ".envmng"))).toBe(false);
  });

  it("does not overwrite existing example values or sync other profiles by default", async () => {
    const root = fixture();
    writeFileSync(join(root, ".env.example"), "FOO=sample\n");
    writeFileSync(join(root, ".local.env"), "FOO=old\n");
    writeFileSync(join(root, ".prod.env"), "OTHER=keep\n");

    await addEnvKey({ root, name: "local", key: "FOO", value: "fake-runtime-secret", syncProfiles: false });

    expect(read(root, ".env.example")).toBe("FOO=sample\n");
    expect(value(root, ".local.env", "FOO")).toBe("fake-runtime-secret");
    expect(read(root, ".prod.env")).toBe("OTHER=keep\n");
  });

  it("updating prod preserves generated root and consumer output and the active profile", async () => {
    const root = fixture();
    const consumer = join(root, "apps", "api");
    mkdirSync(consumer, { recursive: true });
    writeFileSync(join(root, ".env.example"), "API_TOKEN=\n");
    writeFileSync(join(root, ".prod.env"), "API_TOKEN=old\n");
    writeFileSync(join(root, ".env"), "API_TOKEN=local-value\n");
    writeFileSync(join(root, ".envmng"), "# active profile\nENV=local\n");
    writeFileSync(join(consumer, ".env.example"), "API_TOKEN={{API_TOKEN}}\n");
    writeFileSync(join(consumer, ".prod.env"), "API_TOKEN={{API_TOKEN}}\n");
    writeFileSync(join(consumer, ".env"), "API_TOKEN=local-value\n");

    await addEnvKey({ root, name: "prod", key: "API_TOKEN", value: "fake-prod-secret", syncProfiles: false });

    expect(value(root, ".prod.env", "API_TOKEN")).toBe("fake-prod-secret");
    expect(read(root, ".env")).toBe("API_TOKEN=local-value\n");
    expect(read(root, "apps/api/.env")).toBe("API_TOKEN=local-value\n");
    expect(read(root, ".envmng")).toBe("# active profile\nENV=local\n");
  });

  it("does not create a missing root example or generated files when adding to prod", async () => {
    const root = fixture();

    await addEnvKey({ root, name: "prod", key: "API_TOKEN", value: "fake-prod-secret", syncProfiles: false });

    expect(value(root, ".prod.env", "API_TOKEN")).toBe("fake-prod-secret");
    expect(existsSync(join(root, ".env.example"))).toBe(false);
    expect(existsSync(join(root, ".env"))).toBe(false);
    expect(existsSync(join(root, ".envmng"))).toBe(false);
  });
});
