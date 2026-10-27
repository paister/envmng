import { parse } from "dotenv";
import { parseEnvFile } from "./parse.ts";
import { collectPlaceholders } from "./render.ts";

export type CheckSeverity = "error" | "warning";

export type CheckIssueCode =
  | "missing_central"
  | "missing_root_example"
  | "missing_app_template"
  | "unresolved_placeholder"
  | "empty_value"
  | "drift_central_key"
  | "drift_app_key"
  /** `process.env.KEY` in app source, absent from that app's `.env.example`. */
  | "used_missing"
  /** Key in app `.env.example` with no static source reference. */
  | "declared_unused";

export type CheckIssue = {
  severity: CheckSeverity;
  code: CheckIssueCode;
  message: string;
  file?: string;
  key?: string;
  /** Related paths (e.g. templates that reference an empty central key). */
  refs?: string[];
};

export type AppSnapshot = {
  relPath: string;
  /** App .env.example contents; null if the app has no example. */
  exampleText: string | null;
  /** App named profile template contents; null if missing. */
  templateText: string | null;
};

export type ProfileSnapshot = {
  name: string;
  profileFile: string;
  /** Root named profile contents; null if missing. */
  centralText: string | null;
  /** Root .env.example contents; null if missing. */
  rootExampleText: string | null;
  apps: AppSnapshot[];
};

export type CheckReport = {
  name: string;
  issues: CheckIssue[];
  errorCount: number;
  warningCount: number;
};

/** True when a raw value loads as an empty string under dotenv semantics. */
export const isEmptyEnvValue = (raw: string): boolean => parse(`VALUE=${raw}`).VALUE === "";

const sortedKeys = (text: string): string[] => [...parseEnvFile(text).keys()].sort();

const missingFrom = (required: readonly string[], present: ReadonlySet<string>): string[] =>
  required.filter(key => !present.has(key));

/**
 * Pure validation of a named env profile against examples and placeholders.
 * Does not touch the filesystem.
 */
export const analyzeProfile = (snap: ProfileSnapshot): CheckReport => {
  const issues: CheckIssue[] = [];
  const { name, profileFile } = snap;

  if (snap.centralText === null) {
    issues.push({
      severity: "error",
      code: "missing_central",
      message: `Missing ${profileFile}. Run: pnpm envmng create ${name}`,
      file: profileFile,
    });
  }

  if (snap.rootExampleText === null) {
    issues.push({
      severity: "warning",
      code: "missing_root_example",
      message: "Missing root .env.example — cannot check central key drift",
      file: ".env.example",
    });
  }

  const centralValues = snap.centralText === null ? null : parseEnvFile(snap.centralText);
  const centralKeys = new Set(centralValues?.keys() ?? []);

  if (snap.centralText !== null && snap.rootExampleText !== null) {
    const exampleKeys = sortedKeys(snap.rootExampleText);
    for (const key of missingFrom(exampleKeys, centralKeys)) {
      issues.push({
        severity: "warning",
        code: "drift_central_key",
        message: `Key ${key} is in .env.example but missing from ${profileFile}`,
        file: profileFile,
        key,
      });
    }
  }

  /** key → app template files that reference it via {{KEY}} */
  const emptyRefs = new Map<string, string[]>();
  const unresolvedSeen = new Set<string>();

  for (const app of snap.apps) {
    if (app.exampleText === null) continue;

    const exampleFile = `${app.relPath}/.env.example`;
    const templateFile = `${app.relPath}/${profileFile}`;

    if (app.templateText === null) {
      issues.push({
        severity: "error",
        code: "missing_app_template",
        message: `Missing ${templateFile} (has .env.example). Run: pnpm envmng create ${name}`,
        file: templateFile,
      });
      continue;
    }

    const exampleKeys = sortedKeys(app.exampleText);
    const templateKeys = new Set(sortedKeys(app.templateText));
    for (const key of missingFrom(exampleKeys, templateKeys)) {
      issues.push({
        severity: "warning",
        code: "drift_app_key",
        message: `Key ${key} is in ${exampleFile} but missing from ${templateFile}`,
        file: templateFile,
        key,
      });
    }

    for (const key of collectPlaceholders(app.templateText)) {
      if (centralValues === null) continue;
      if (!centralValues.has(key)) {
        if (!unresolvedSeen.has(key)) {
          unresolvedSeen.add(key);
          issues.push({
            severity: "error",
            code: "unresolved_placeholder",
            message: `{{${key}}} has no entry in ${profileFile} (e.g. ${templateFile})`,
            file: profileFile,
            key,
          });
        }
        continue;
      }
      if (isEmptyEnvValue(centralValues.get(key)!)) {
        const refs = emptyRefs.get(key) ?? [];
        refs.push(templateFile);
        emptyRefs.set(key, refs);
      }
    }
  }

  for (const key of [...emptyRefs.keys()].sort()) {
    const refs = emptyRefs.get(key)!;
    const shown = refs.slice(0, 3).join(", ");
    const more = refs.length > 3 ? ` (+${refs.length - 3} more)` : "";
    issues.push({
      severity: "warning",
      code: "empty_value",
      message: `${key} is empty in ${profileFile} (referenced by ${shown}${more})`,
      file: profileFile,
      key,
      refs,
    });
  }
  const errorCount = issues.filter(i => i.severity === "error").length;
  const warningCount = issues.filter(i => i.severity === "warning").length;
  return { name, issues, errorCount, warningCount };
};

export const isCheckPassing = (report: CheckReport, strict: boolean): boolean => {
  if (report.errorCount > 0) return false;
  if (strict && report.warningCount > 0) return false;
  return true;
};

/** Recount severities after appending issues (e.g. source↔example). */
export const recountCheckReport = (report: CheckReport): CheckReport => {
  const errorCount = report.issues.filter(i => i.severity === "error").length;
  const warningCount = report.issues.filter(i => i.severity === "warning").length;
  return { ...report, errorCount, warningCount };
};

/** Build a standalone report for source↔example issues (profile-independent). */
export const sourceCheckReport = (issues: CheckIssue[]): CheckReport =>
  recountCheckReport({ name: "source", issues, errorCount: 0, warningCount: 0 });
