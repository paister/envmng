import { describe, expect, it } from "vite-plus/test";
import { analyzeAudit, isAuditPassing } from "./audit-analysis";

describe("analyzeAudit", () => {
  it("flags used-missing and declared-unused", () => {
    const report = analyzeAudit({
      target: "workers",
      exampleRel: "apps/workers/.env.example",
      declared: new Set(["DATABASE_URL", "ORPHAN"]),
      used: new Set(["DATABASE_URL", "NODE_ENV"]),
      filesScanned: 3,
      declareHint: key => `declare ${key}`,
    });

    expect(report.missingCount).toBe(1);
    expect(report.unusedCount).toBe(1);
    expect(report.issues.map(i => `${i.code}:${i.key}`).sort()).toEqual([
      "declared_unused:ORPHAN",
      "used_missing:NODE_ENV",
    ]);
    expect(isAuditPassing(report, false)).toBe(false);
    const unusedOnly = analyzeAudit({
      target: "workers",
      exampleRel: "apps/workers/.env.example",
      declared: new Set(["DATABASE_URL", "ORPHAN"]),
      used: new Set(["DATABASE_URL"]),
      filesScanned: 3,
      declareHint: () => "",
    });
    expect(unusedOnly.missingCount).toBe(0);
    expect(isAuditPassing(unusedOnly, false)).toBe(true);
  });

  it("strict treats unused as failure", () => {
    const report = analyzeAudit({
      target: "workers",
      exampleRel: "apps/workers/.env.example",
      declared: new Set(["ORPHAN"]),
      used: new Set(),
      filesScanned: 1,
      declareHint: () => "",
    });
    expect(isAuditPassing(report, false)).toBe(true);
    expect(isAuditPassing(report, true)).toBe(false);
  });
});
