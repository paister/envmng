import type { CheckIssue, CheckIssueCode, CheckReport, CheckSeverity } from "./check-analysis.ts";

const CODE_LABEL: Record<CheckIssueCode, string> = {
  missing_central: "missing central profile",
  missing_root_example: "missing root .env.example",
  missing_app_template: "missing app template",
  unresolved_placeholder: "unresolved placeholder",
  empty_value: "empty value",
  drift_central_key: "drift vs root .env.example",
  drift_app_key: "drift vs app .env.example",
  used_missing: "used in source, missing from .env.example",
  declared_unused: "in .env.example, unused in source",
};

const COLLAPSE_AFTER = 8;

type TreeOpts = {
  verbose: boolean;
};

const branch = (isLast: boolean) => (isLast ? "└── " : "├── ");
const gutter = (isLast: boolean) => (isLast ? "    " : "│   ");

const push = (lines: string[], prefix: string, isLast: boolean, label: string) => {
  lines.push(`${prefix}${branch(isLast)}${label}`);
};

const nest = (prefix: string, isLast: boolean) => `${prefix}${gutter(isLast)}`;

const issueLabel = (issue: CheckIssue): string => {
  if (
    issue.key &&
    issue.file &&
    (issue.code === "drift_app_key" ||
      issue.code === "used_missing" ||
      issue.code === "declared_unused")
  ) {
    return `${issue.key}  ←  ${issue.file}`;
  }
  if (issue.key) return issue.key;
  if (issue.file) return issue.file;
  return issue.message;
};

const groupByCode = (issues: CheckIssue[]): [CheckIssueCode, CheckIssue[]][] => {
  const map = new Map<CheckIssueCode, CheckIssue[]>();
  for (const issue of issues) {
    const list = map.get(issue.code) ?? [];
    list.push(issue);
    map.set(issue.code, list);
  }
  return [...map.entries()];
};

const renderIssueNodes = (
  lines: string[],
  prefix: string,
  issues: CheckIssue[],
  verbose: boolean
) => {
  const visible = verbose ? issues : issues.slice(0, COLLAPSE_AFTER);
  const hidden = issues.length - visible.length;

  visible.forEach((issue, i) => {
    const isLastIssue = i === visible.length - 1 && hidden === 0;
    const refs = verbose ? (issue.refs ?? []) : [];
    const hasRefs = refs.length > 0;

    push(lines, prefix, isLastIssue && !hasRefs, issueLabel(issue));

    if (!hasRefs) return;

    const refPrefix = nest(prefix, isLastIssue);
    refs.forEach((ref, ri) => {
      push(lines, refPrefix, ri === refs.length - 1, ref);
    });
  });

  if (hidden > 0) {
    push(lines, prefix, true, `… +${hidden} more (use -v)`);
  }
};

const renderSeverity = (
  lines: string[],
  prefix: string,
  isLast: boolean,
  severity: CheckSeverity,
  issues: CheckIssue[],
  verbose: boolean
) => {
  const icon = severity === "error" ? "✕" : "⚠";
  push(lines, prefix, isLast, `${icon} ${severity}s (${issues.length})`);
  const p = nest(prefix, isLast);

  const groups = groupByCode(issues);
  groups.forEach(([code, group], i) => {
    const isLastGroup = i === groups.length - 1;
    push(lines, p, isLastGroup, `${CODE_LABEL[code]} (${group.length})`);
    renderIssueNodes(lines, nest(p, isLastGroup), group, verbose);
  });
};

const renderProfileBody = (
  lines: string[],
  prefix: string,
  report: CheckReport,
  verbose: boolean
) => {
  const errors = report.issues.filter(i => i.severity === "error");
  const warnings = report.issues.filter(i => i.severity === "warning");

  if (errors.length > 0) {
    renderSeverity(lines, prefix, warnings.length === 0, "error", errors, verbose);
  }
  if (warnings.length > 0) {
    renderSeverity(lines, prefix, true, "warning", warnings, verbose);
  }
};

const profileHeadline = (report: CheckReport): string => {
  if (report.issues.length === 0) return `${report.name}  ✓ ok`;
  return `${report.name}  ✕ ${report.errorCount} error(s) · ${report.warningCount} warning(s)`;
};

/** Format one or more check reports as a unicode tree. */
export const formatCheckTree = (reports: CheckReport[], opts: TreeOpts): string => {
  const lines: string[] = [];
  const totalE = reports.reduce((n, r) => n + r.errorCount, 0);
  const totalW = reports.reduce((n, r) => n + r.warningCount, 0);

  if (reports.length === 0) {
    return "check\n└── (no profiles)";
  }

  if (reports.length === 1) {
    const report = reports[0]!;
    lines.push(`check ${profileHeadline(report)}`);
    if (report.issues.length > 0) {
      renderProfileBody(lines, "", report, opts.verbose);
    }
    return lines.join("\n");
  }

  const profileCount = reports.filter(r => r.name !== "source").length;
  const hasSource = reports.some(r => r.name === "source");
  const scope = hasSource ? `${profileCount} profiles + source` : `${profileCount} profiles`;
  lines.push(`check all  (${scope} · ${totalE} error(s) · ${totalW} warning(s))`);
  reports.forEach((report, i) => {
    const isLast = i === reports.length - 1;
    push(lines, "", isLast, profileHeadline(report));
    if (report.issues.length > 0) {
      renderProfileBody(lines, nest("", isLast), report, opts.verbose);
    }
  });
  return lines.join("\n");
};
