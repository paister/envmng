import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { consumerRelPath, listConsumerDirs, listExistingProfileNames } from "./workspace";

describe("listConsumerDirs", () => {
  it("finds dirs with .env.example under any layout", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-consumers-"));
    writeFileSync(join(root, ".env.example"), "A=\n");

    const api = join(root, "apps", "api");
    mkdirSync(api, { recursive: true });
    writeFileSync(join(api, ".env.example"), "A={{A}}\n");

    const svc = join(root, "services", "worker");
    mkdirSync(svc, { recursive: true });
    writeFileSync(join(svc, ".env.example"), "B={{B}}\n");

    const nestedJunk = join(root, "apps", "api", "node_modules", "pkg");
    mkdirSync(nestedJunk, { recursive: true });
    writeFileSync(join(nestedJunk, ".env.example"), "NO={{NO}}\n");

    const dirs = listConsumerDirs(root);
    expect(dirs.map(d => consumerRelPath(root, d)).sort()).toEqual(["apps/api", "services/worker"]);
  });

  it("does not treat the monorepo root as a consumer", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-root-ex-"));
    writeFileSync(join(root, ".env.example"), "A=\n");
    expect(listConsumerDirs(root)).toEqual([]);
  });
});

describe("listExistingProfileNames", () => {
  it("unions root and consumer profile files", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-profiles-"));
    writeFileSync(join(root, ".local.env"), "A=1\n");
    writeFileSync(join(root, ".env.example"), "A=\n");
    const api = join(root, "apps", "api");
    mkdirSync(api, { recursive: true });
    writeFileSync(join(api, ".local.env"), "A={{A}}\n");
    writeFileSync(join(api, ".prev.env"), "A={{A}}\n");
    writeFileSync(join(api, ".env.example"), "A={{A}}\n");

    expect(listExistingProfileNames(root)).toEqual(["local", "prev"]);
  });

  it("finds profiles under non-apps consumers", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-svc-prof-"));
    writeFileSync(join(root, ".env.example"), "A=\n");
    const svc = join(root, "services", "api");
    mkdirSync(svc, { recursive: true });
    writeFileSync(join(svc, ".env.example"), "A={{A}}\n");
    writeFileSync(join(svc, ".staging.env"), "A={{A}}\n");

    expect(listExistingProfileNames(root)).toEqual(["staging"]);
  });
});
