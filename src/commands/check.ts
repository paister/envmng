import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { analyzeAudit } from "../audit-analysis.ts";
import { consumerRelFromIssueFile, ensureConsumerTemplates, ensureRootExample } from "../catalogue.ts";
import { analyzeProfile, isCheckPassing, recountCheckReport, sourceCheckReport, type AppSnapshot, type CheckIssue, type CheckReport, type ProfileSnapshot } from "../check-analysis.ts";
import { formatCheckTree } from "../check-tree.ts";
import { assertEnvName, namedEnvFile } from "../names.ts";
import { parseEnvFile, upsertEnvKey } from "../parse.ts";
import { collectUsedEnvKeys } from "../scan-usage.ts";
import { consumerRelPath, listConsumerDirs, listExistingProfileNames } from "../workspace.ts";

export type CheckOptions = {
  root: string;
  /** When omitted, check every profile found on disk. */
  name?: string;
  strict: boolean;
  verbose: boolean;
  /** Skip static source ↔ `.env.example` scan. */
  skipSource: boolean;
  /** Keys excluded from the source ↔ example scan. */
  ignore: string[];
  /**
   * Auto-fix safe catalogue gaps:
   * - `used_missing` → consumer + root `.env.example` (empty root sample)
   * - `drift_app_key` / `drift_central_key` → copy missing keys into profiles
   */
  fix: boolean;
  /** Include `tests/` / `*.test.ts` in the source scan (default: runtime only). */
  includeTests: boolean;
};

export type CheckAllResult = {
  reports: CheckReport[];
  ok: boolean;
  fixed: string[];
};

const readOptional = (path: string): string | null => (existsSync(path) ? readFileSync(path, "utf8") : null);

const loadSnapshot = (root: string, name: string): ProfileSnapshot => {
  const profileFile = namedEnvFile(name);
  const apps: AppSnapshot[] = [];

  for (const dir of listConsumerDirs(root)) {
    const exampleText = readOptional(join(dir, ".env.example"));
    if (exampleText === null) continue;
    apps.push({
      relPath: consumerRelPath(root, dir),
      exampleText,
      templateText: readOptional(join(dir, profileFile)),
    });
  }

  return {
    name,
    profileFile,
    centralText: readOptional(resolve(root, profileFile)),
    rootExampleText: readOptional(resolve(root, ".env.example")),
    apps,
  };
};

const analyzeOne = (root: string, name: string): CheckReport => {
  assertEnvName(name);
  return analyzeProfile(loadSnapshot(root, name));
};

/** Source ↔ example issues for every consumer (profile-independent). */
export const collectSourceIssues = (root: string, ignore: ReadonlySet<string>, includeTests: boolean): CheckIssue[] => {
  const issues: CheckIssue[] = [];

  for (const consumerDir of listConsumerDirs(root)) {
    const rel = consumerRelPath(root, consumerDir);
    const examplePath = join(consumerDir, ".env.example");
    const exampleRel = `${rel}/.env.example`;
    const declaredRaw = new Set(parseEnvFile(readFileSync(examplePath, "utf8")).keys());
    const declared = new Set([...declaredRaw].filter((k) => !ignore.has(k)));
    const { keys: usedRaw } = collectUsedEnvKeys(consumerDir, { ignore, includeTests });
    const used = new Set([...usedRaw].filter((k) => !ignore.has(k)));

    const audit = analyzeAudit({
      target: rel,
      exampleRel,
      declared,
      used,
      filesScanned: 0,
      declareHint: (key) => `add ${key}={{${key}}} to ${exampleRel} (or: pnpm envmng check --fix)`,
    });

    for (const issue of audit.issues) {
      if (issue.code === "used_missing") {
        issues.push({
          severity: "error",
          code: "used_missing",
          key: issue.key,
          file: exampleRel,
          message: issue.message,
          refs: [issue.message],
        });
      } else {
        issues.push({
          severity: "warning",
          code: "declared_unused",
          key: issue.key,
          file: exampleRel,
          message: issue.message,
        });
      }
    }
  }

  return issues;
};

const attachSourceIssues = (profileReports: CheckReport[], sourceIssues: CheckIssue[]): CheckReport[] => {
  if (sourceIssues.length === 0) return profileReports;
  if (profileReports.length === 1) {
    const only = profileReports[0]!;
    return [
      recountCheckReport({
        ...only,
        issues: [...only.issues, ...sourceIssues],
      }),
    ];
  }
  return [...profileReports, sourceCheckReport(sourceIssues)];
};

const buildReports = (
  root: string,
  name: string | undefined,
  skipSource: boolean,
  ignoreSet: ReadonlySet<string>,
  includeTests: boolean,
): { reports: CheckReport[]; sourceIssues: CheckIssue[] } | null => {
  let profileReports: CheckReport[];

  if (name !== undefined && name !== "") {
    profileReports = [analyzeOne(root, name)];
  } else {
    const names = listExistingProfileNames(root);
    if (names.length === 0) return null;
    profileReports = names.map((profile) => analyzeOne(root, profile));
  }

  const sourceIssues = skipSource ? [] : collectSourceIssues(root, ignoreSet, includeTests);
  return {
    reports: attachSourceIssues(profileReports, sourceIssues),
    sourceIssues,
  };
};

/**
 * Apply safe catalogue / drift fixes. Returns log lines of what changed.
 * Does not invent secret values (root example samples stay empty for used_missing).
 */
export const applyCheckFixes = (root: string, reports: CheckReport[]): string[] => {
  const logs: string[] = [];
  const seenUsed = new Set<string>();

  for (const report of reports) {
    for (const issue of report.issues) {
      if (issue.code === "used_missing" && issue.key) {
        const consumerRel = consumerRelFromIssueFile(issue.file);
        if (!consumerRel) continue;
        const dedupe = `${consumerRel}:${issue.key}`;
        if (seenUsed.has(dedupe)) continue;
        seenUsed.add(dedupe);

        const rootEx = ensureRootExample(root, issue.key);
        if (rootEx.changed) logs.push(rootEx.message);

        const consumerFix = ensureConsumerTemplates(root, consumerRel, issue.key);
        if (consumerFix.changed) logs.push(...consumerFix.messages);
      }

      if (issue.code === "drift_central_key" && issue.key) {
        const profileFile = report.name === "source" ? null : namedEnvFile(report.name);
        if (!profileFile) continue;
        const path = resolve(root, profileFile);
        if (!existsSync(path)) continue;
        const previous = readFileSync(path, "utf8");
        if (parseEnvFile(previous).has(issue.key)) continue;
        // Prefer sample from root .env.example when present.
        const examplePath = resolve(root, ".env.example");
        const sample = existsSync(examplePath) ? (parseEnvFile(readFileSync(examplePath, "utf8")).get(issue.key) ?? "") : "";
        const { text } = upsertEnvKey(previous, issue.key, sample);
        writeFileSync(path, text, "utf8");
        logs.push(`added ${issue.key} in ${profileFile}`);
      }

      if (issue.code === "drift_app_key" && issue.key && issue.file) {
        // issue.file is the missing template path, e.g. apps/workers/.local.env
        const templatePath = resolve(root, issue.file);
        const consumerRel = consumerRelFromIssueFile(issue.file);
        if (!consumerRel || !existsSync(templatePath)) continue;
        const examplePath = resolve(root, consumerRel, ".env.example");
        if (!existsSync(examplePath)) continue;
        const exampleMap = parseEnvFile(readFileSync(examplePath, "utf8"));
        const raw = exampleMap.get(issue.key);
        if (raw === undefined) continue;
        const previous = readFileSync(templatePath, "utf8");
        if (parseEnvFile(previous).has(issue.key)) continue;
        const { text } = upsertEnvKey(previous, issue.key, raw);
        writeFileSync(templatePath, text, "utf8");
        logs.push(`added ${issue.key} in ${issue.file}`);
      }
    }
  }

  return logs;
};

/**
 * Validate one profile, or every profile present on disk when `name` is omitted.
 * Always includes a static source ↔ `.env.example` scan (unless `--no-source`).
 */
export const checkEnv = ({ root, name, strict, verbose, skipSource, ignore, fix, includeTests }: CheckOptions): CheckAllResult => {
  const ignoreSet = new Set(ignore);
  const first = buildReports(root, name, skipSource, ignoreSet, includeTests);
  if (first === null) {
    console.error("No profiles found (no .{name}.env under root or consumers).");
    console.error("Run: pnpm envmng create local");
    return { reports: [], ok: false, fixed: [] };
  }

  let { reports, sourceIssues } = first;
  let fixed: string[] = [];

  if (fix) {
    fixed = applyCheckFixes(root, reports);
    if (fixed.length > 0) {
      console.log(`→ fix (${fixed.length})`);
      for (const line of fixed) console.log(`  ${line}`);
      console.log("");
      const again = buildReports(root, name, skipSource, ignoreSet, includeTests);
      if (again) {
        reports = again.reports;
        sourceIssues = again.sourceIssues;
      }
    } else {
      console.log("→ fix (nothing to apply)\n");
    }
  }

  console.log(formatCheckTree(reports, { verbose }));

  const ok = reports.every((r) => isCheckPassing(r, strict));
  if (!ok && strict) {
    const warnings = reports.reduce((n, r) => n + r.warningCount, 0);
    const errors = reports.reduce((n, r) => n + r.errorCount, 0);
    if (errors === 0 && warnings > 0) {
      console.error(`\nFailed with --strict (${warnings} warning(s)).`);
    }
  }

  if (!fix && !skipSource && sourceIssues.some((i) => i.code === "used_missing") && !verbose) {
    console.log(`\nFix missing: pnpm envmng check --fix`);
  }

  return { reports, ok, fixed };
};

export { isCheckPassing };
