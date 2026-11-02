export type AuditIssueCode = "used_missing" | "declared_unused";

export type AuditIssue = {
  code: AuditIssueCode;
  key: string;
  /** Human-readable hint (e.g. declare command). */
  message: string;
};

export type AuditReport = {
  /** App id (`workers`) or `root` when scanning repo root packages. */
  target: string;
  /** Relative path of the .env.example that was compared, or null. */
  exampleRel: string | null;
  filesScanned: number;
  usedCount: number;
  declaredCount: number;
  issues: AuditIssue[];
  missingCount: number;
  unusedCount: number;
};

export type AuditSnapshot = {
  target: string;
  exampleRel: string | null;
  /** Keys from .env.example (empty if no example). */
  declared: ReadonlySet<string>;
  /** Keys found in source. */
  used: ReadonlySet<string>;
  filesScanned: number;
  /** Suggested CLI for fixing a missing key. */
  declareHint: (key: string) => string;
};

/** Diff used keys vs declared keys in an example file. */
export const analyzeAudit = (snapshot: AuditSnapshot): AuditReport => {
  const issues: AuditIssue[] = [];

  const declaredSorted = [...snapshot.declared].sort();
  const usedSorted = [...snapshot.used].sort();

  for (const key of usedSorted) {
    if (snapshot.declared.has(key)) continue;
    issues.push({
      code: "used_missing",
      key,
      message: snapshot.declareHint(key),
    });
  }

  for (const key of declaredSorted) {
    if (snapshot.used.has(key)) continue;
    issues.push({
      code: "declared_unused",
      key,
      message: `in ${snapshot.exampleRel ?? ".env.example"} but no static process.env / import.meta.env reference`,
    });
  }

  const missingCount = issues.filter(i => i.code === "used_missing").length;
  const unusedCount = issues.filter(i => i.code === "declared_unused").length;

  return {
    target: snapshot.target,
    exampleRel: snapshot.exampleRel,
    filesScanned: snapshot.filesScanned,
    usedCount: snapshot.used.size,
    declaredCount: snapshot.declared.size,
    issues,
    missingCount,
    unusedCount,
  };
};

export const isAuditPassing = (report: AuditReport, strict: boolean): boolean => {
  if (report.missingCount > 0) return false;
  if (strict && report.unusedCount > 0) return false;
  return true;
};
