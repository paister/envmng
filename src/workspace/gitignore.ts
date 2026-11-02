import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const BEGIN = "# >>> envmng";
const END = "# <<< envmng";

/** Core ignore rules envmng keeps in the root .gitignore. */
export const ENVMNG_GITIGNORE_CORE = [
  ".env",
  "**/.env",
  "!.env.example",
  "!**/.env.example",
  ".envmng",
  /** Named profiles at root and under consumers (may contain secrets). */
  ".envmng.*",
] as const;

export type EnsureGitignoreResult = {
  /** Absolute path, or null when no .gitignore exists. */
  path: string | null;
  updated: boolean;
  added: string[];
};

const normalizeEntry = (line: string): string => line.trim();

/** True if `entry` already appears as a gitignore line. */
export const gitignoreHasEntry = (text: string, entry: string): boolean => {
  const wanted = normalizeEntry(entry);

  for (const raw of text.split(/\r?\n/)) {
    const line = normalizeEntry(raw);
    if (!line || line.startsWith("#")) continue;
    if (line === wanted) return true;
  }
  return false;
};

const buildManagedBlock = (): string =>
  [BEGIN, "# managed by envmng (init / create)", ...ENVMNG_GITIGNORE_CORE, END].join("\n");

/**
 * Ensure envmng ignore rules exist in root `.gitignore`.
 * No-ops when the file is missing (does not create one).
 */
export const ensureGitignore = (root: string): EnsureGitignoreResult => {
  const path = resolve(root, ".gitignore");
  if (!existsSync(path)) {
    return { path: null, updated: false, added: [] };
  }

  const original = readFileSync(path, "utf8");

  const missing = [...ENVMNG_GITIGNORE_CORE].filter(
    entry => !gitignoreHasEntry(original, entry)
  );

  if (missing.length === 0) {
    return { path, updated: false, added: [] };
  }

  const begin = original.indexOf(BEGIN);
  const end = original.indexOf(END);

  let next: string;
  if (begin >= 0 && end > begin) {
    // Canonical refresh of the managed block.
    const block = buildManagedBlock();
    const afterEnd = end + END.length;
    next = `${original.slice(0, begin)}${block}${original.slice(afterEnd)}`;
  } else {
    // No managed block yet: only append what's missing (avoid duplicating
    // patterns that already live elsewhere in the file).
    const block = [BEGIN, "# managed by envmng (init / create)", ...missing, END].join("\n");
    const trimmed = original.replace(/\s*$/, "");
    next = `${trimmed}\n\n${block}\n`;
  }

  // Avoid double trailing newlines explosion
  if (!next.endsWith("\n")) next = `${next}\n`;

  writeFileSync(path, next, "utf8");
  return { path, updated: true, added: missing };
};

export const logGitignoreResult = (result: EnsureGitignoreResult): void => {
  if (result.path === null) {
    console.log("skip .gitignore (not found)");
    return;
  }
  if (!result.updated) {
    console.log("ok .gitignore (envmng entries present)");
    return;
  }
  console.log(`updated .gitignore (+${result.added.length}): ${result.added.join(", ")}`);
};
