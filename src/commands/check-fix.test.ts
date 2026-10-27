import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { parseEnvFile } from "../parse";
import { applyCheckFixes, checkEnv } from "./check";
import type { CheckReport } from "../check-analysis";

describe("applyCheckFixes / check --fix", () => {
  it("adds used_missing keys to app + root examples", () => {
    const root = mkdtempSync(join(tmpdir(), "envmng-fix-"));
    mkdirSync(join(root, "apps", "workers", "src"), { recursive: true });
    writeFileSync(join(root, ".env.example"), "DATABASE_URL=\n");
    writeFileSync(join(root, ".local.env"), "DATABASE_URL=postgres://x\n");
    writeFileSync(join(root, "apps/workers/.env.example"), "DATABASE_URL={{DATABASE_URL}}\n");
    writeFileSync(join(root, "apps/workers/.local.env"), "DATABASE_URL={{DATABASE_URL}}\n");
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
    writeFileSync(join(root, ".local.env"), "DATABASE_URL=postgres://x\n");
    writeFileSync(join(root, "services/api/.env.example"), "DATABASE_URL={{DATABASE_URL}}\n");
    writeFileSync(join(root, "services/api/.local.env"), "DATABASE_URL={{DATABASE_URL}}\n");
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
    writeFileSync(join(root, ".local.env"), "\n");

    const report: CheckReport = {
      name: "local",
      errorCount: 0,
      warningCount: 1,
      issues: [
        {
          severity: "warning",
          code: "drift_central_key",
          key: "FOO",
          file: ".local.env",
          message: "missing",
        },
      ],
    };

    const logs = applyCheckFixes(root, [report]);
    expect(logs).toContain("added FOO in .local.env");
    expect(parseEnvFile(readFileSync(join(root, ".local.env"), "utf8")).get("FOO")).toBe("sample");
  });
});
