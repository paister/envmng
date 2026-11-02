import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import type { CheckReport } from "../check/index.ts";
import { parseEnvFile } from "../core/parse";
import { applyCheckFixes, checkEnv } from "./check";

describe("applyCheckFixes / check --fix", () => {
  it("adds used_missing keys to app + root examples", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-fix-"));
    mkdirSync(join(root, "apps", "workers", "src"), { recursive: true });
    writeFileSync(join(root, ".env.example"), "DATABASE_URL=\n");
    writeFileSync(join(root, ".envmng.local"), "DATABASE_URL=postgres://x\n");
    writeFileSync(join(root, "apps/workers/.env.example"), "DATABASE_URL={{DATABASE_URL}}\n");
    writeFileSync(join(root, "apps/workers/.envmng.local"), "DATABASE_URL={{DATABASE_URL}}\n");
    writeFileSync(
      join(root, "apps/workers/src/index.ts"),
      `console.log(process.env.NODE_ENV, process.env.DATABASE_URL);\n`
    );

    const { ok, fixed, reports } = checkEnv({
      root,
      name: "local",
      strict: false,
      verbose: false,
      skipSource: false,
      ignore: [],
      fix: true,
      includeTests: false,
    });

    expect(fixed.some(l => l.includes("NODE_ENV") && l.includes(".env.example"))).toBe(true);
    expect(
      parseEnvFile(readFileSync(join(root, "apps/workers/.env.example"), "utf8")).get("NODE_ENV")
    ).toBe("{{NODE_ENV}}");
    expect(parseEnvFile(readFileSync(join(root, ".env.example"), "utf8")).has("NODE_ENV")).toBe(
      true
    );
    expect(reports.every(r => !r.issues.some(i => i.code === "used_missing"))).toBe(true);
    // NODE_ENV now in example but empty in central → unresolved or empty after placeholder
    expect(ok).toBe(false); // unresolved_placeholder until value is set
  });

  it("discovers consumers outside apps/ and fixes used_missing", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-fix-svc-"));
    mkdirSync(join(root, "services", "api", "src"), { recursive: true });
    writeFileSync(join(root, ".env.example"), "DATABASE_URL=\n");
    writeFileSync(join(root, ".envmng.local"), "DATABASE_URL=postgres://x\n");
    writeFileSync(join(root, "services/api/.env.example"), "DATABASE_URL={{DATABASE_URL}}\n");
    writeFileSync(join(root, "services/api/.envmng.local"), "DATABASE_URL={{DATABASE_URL}}\n");
    writeFileSync(join(root, "services/api/src/index.ts"), `console.log(process.env.API_TOKEN);\n`);

    const { fixed, reports } = checkEnv({
      root,
      name: "local",
      strict: false,
      verbose: false,
      skipSource: false,
      ignore: [],
      fix: true,
      includeTests: false,
    });

    expect(fixed.some(l => l.includes("API_TOKEN") && l.includes("services/api"))).toBe(true);
    expect(
      parseEnvFile(readFileSync(join(root, "services/api/.env.example"), "utf8")).get("API_TOKEN")
    ).toBe("{{API_TOKEN}}");
    expect(reports.every(r => !r.issues.some(i => i.code === "used_missing"))).toBe(true);
  });

  it("fills drift_central_key from root example sample", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-fix-drift-"));
    writeFileSync(join(root, ".env.example"), "FOO=sample\n");
    writeFileSync(join(root, ".envmng.local"), "\n");

    const report: CheckReport = {
      name: "local",
      errorCount: 0,
      warningCount: 1,
      issues: [
        {
          severity: "warning",
          code: "drift_central_key",
          key: "FOO",
          file: ".envmng.local",
          message: "missing",
        },
      ],
    };

    const logs = applyCheckFixes(root, [report]);
    expect(logs).toContain("added FOO in .envmng.local");
    expect(parseEnvFile(readFileSync(join(root, ".envmng.local"), "utf8")).get("FOO")).toBe("sample");
  });
});

describe("check --unused", () => {
  const fixture = () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-unused-"));
    mkdirSync(join(root, "apps", "web", "src"), { recursive: true });
    writeFileSync(join(root, ".env.example"), "USED=\nORPHAN=\n");
    writeFileSync(join(root, ".envmng.local"), "USED=1\nORPHAN=1\n");
    writeFileSync(join(root, "apps/web/.env.example"), "USED={{USED}}\nORPHAN={{ORPHAN}}\n");
    writeFileSync(join(root, "apps/web/.envmng.local"), "USED={{USED}}\nORPHAN={{ORPHAN}}\n");
    writeFileSync(join(root, "apps/web/src/index.ts"), `console.log(process.env.USED);\n`);
    return root;
  };

  const base = (root: string, includeUnused: boolean) =>
    checkEnv({
      root,
      name: "local",
      strict: false,
      verbose: false,
      skipSource: false,
      ignore: [],
      fix: false,
      includeTests: false,
      includeUnused,
    });

  it("omits declared_unused by default", () => {
    const { reports } = base(fixture(), false);
    expect(reports.flatMap(r => r.issues).some(i => i.code === "declared_unused")).toBe(false);
  });

  it("reports declared_unused with includeUnused", () => {
    const { reports } = base(fixture(), true);
    const unused = reports.flatMap(r => r.issues).filter(i => i.code === "declared_unused");
    expect(unused.map(i => i.key)).toContain("ORPHAN");
    expect(unused.map(i => i.key)).not.toContain("USED");
  });
});
