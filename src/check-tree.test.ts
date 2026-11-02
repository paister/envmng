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
      file: ".envmng.local",
      key: "FOO",
      refs: ["apps/api/.envmng.local", "apps/web/.envmng.local"],
    },
    {
      severity: "warning",
      code: "drift_central_key",
      message: "EXTRA missing",
      file: ".envmng.local",
      key: "EXTRA",
    },
  ],
});

describe("formatCheckTree", () => {
  it("renders a single ok profile", () => {
    const out = formatCheckTree([okReport("local")], { verbose: false });
    expect(out).toBe("check local  ✓ ok");
  });

  it("groups by file, then severity", () => {
    const out = formatCheckTree([warnReport()], { verbose: false });
    expect(out).toBe(
      [
        "check local  ✕ 0 error(s) · 2 warning(s)",
        "└── .envmng.local",
        "    └── ⚠ warnings (2)",
        "        ├── FOO  empty value",
        "        └── EXTRA  drift vs root .env.example",
      ].join("\n")
    );
  });

  it("shows refs when verbose", () => {
    const out = formatCheckTree([warnReport()], { verbose: true });
    expect(out).toContain("apps/api/.envmng.local");
    expect(out).toContain("apps/web/.envmng.local");
  });

  it("renders multiple profiles under check all", () => {
    const prev = { ...warnReport(), name: "prev" };
    const out = formatCheckTree([okReport("local"), prev], { verbose: false });
    expect(out.startsWith("check all")).toBe(true);
    expect(out).toContain("├── local  ✓ ok");
    expect(out).toContain("└── prev  ✕");
    expect(out).toContain("    └── .envmng.local");
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
    expect(out).toContain("└── source  ✕ 1 error(s) · 0 warning(s)");
    expect(out).toContain("    └── apps/workers/.env.example");
    expect(out).toContain("        └── ✕ errors (1)");
    expect(out).toContain("            └── NODE_ENV  used in source, missing from .env.example");
  });

  it("splits issues across files under one profile", () => {
    const report: CheckReport = {
      name: "local",
      errorCount: 1,
      warningCount: 1,
      issues: [
        {
          severity: "error",
          code: "unresolved_placeholder",
          message: "missing",
          file: ".envmng.local",
          key: "API_URL",
        },
        {
          severity: "warning",
          code: "drift_app_key",
          message: "drift",
          file: "apps/api/.envmng.local",
          key: "PORT",
        },
      ],
    };
    const out = formatCheckTree([report], { verbose: false });
    expect(out).toBe(
      [
        "check local  ✕ 1 error(s) · 1 warning(s)",
        "├── .envmng.local",
        "│   └── ✕ errors (1)",
        "│       └── API_URL  unresolved placeholder",
        "└── apps/api/.envmng.local",
        "    └── ⚠ warnings (1)",
        "        └── PORT  drift vs app .env.example",
      ].join("\n")
    );
  });
});
