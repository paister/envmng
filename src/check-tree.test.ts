import { describe, expect, it } from "vite-plus/test";
import type { CheckReport } from "./check-analysis";
import { formatCheckTree } from "./check-tree";

const okReport = (name: string): CheckReport => ({
  name,
  issues: [],
  errorCount: 0,
  warningCount: 0,
});

const warnReport = (): CheckReport => ({
  name: "local",
  errorCount: 0,
  warningCount: 2,
  issues: [
    {
      severity: "warning",
      code: "empty_value",
      message: "FOO is empty",
      file: ".local.env",
      key: "FOO",
      refs: ["apps/api/.local.env", "apps/web/.local.env"],
    },
    {
      severity: "warning",
      code: "drift_central_key",
      message: "EXTRA missing",
      file: ".local.env",
      key: "EXTRA",
    },
  ],
});

describe("formatCheckTree", () => {
  it("renders a single ok profile", () => {
    const out = formatCheckTree([okReport("local")], { verbose: false });
    expect(out).toBe("check local  ✓ ok");
  });

  it("renders grouped warnings as a tree", () => {
    const out = formatCheckTree([warnReport()], { verbose: false });
    expect(out).toContain("check local  ✕ 0 error(s) · 2 warning(s)");
    expect(out).toContain("⚠ warnings (2)");
    expect(out).toContain("empty value (1)");
    expect(out).toContain("FOO");
    expect(out).toContain("drift vs root .env.example (1)");
    expect(out).not.toContain("apps/api/.local.env");
  });

  it("shows refs when verbose", () => {
    const out = formatCheckTree([warnReport()], { verbose: true });
    expect(out).toContain("apps/api/.local.env");
    expect(out).toContain("apps/web/.local.env");
  });

  it("renders multiple profiles under check all", () => {
    const prev = { ...warnReport(), name: "prev" };
    const out = formatCheckTree([okReport("local"), prev], { verbose: false });
    expect(out.startsWith("check all")).toBe(true);
    expect(out).toContain("├── local  ✓ ok");
    expect(out).toContain("└── prev  ✕");
  });

  it("labels source node when present", () => {
    const source: CheckReport = {
      name: "source",
      errorCount: 1,
      warningCount: 0,
      issues: [
        {
          severity: "error",
          code: "used_missing",
          message: "declare",
          key: "NODE_ENV",
          file: "apps/workers/.env.example",
        },
      ],
    };
    const out = formatCheckTree([okReport("local"), source], { verbose: false });
    expect(out).toContain("profiles + source");
    expect(out).toContain("NODE_ENV  ←  apps/workers/.env.example");
  });
});
