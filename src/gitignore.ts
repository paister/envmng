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
  /** Root named profiles (secrets): .local.env, .prod.env, … */
  "/.*.env",
] as const;

export type EnsureGitignoreResult = {
  /** Absolute path, or null when no .gitignore exists. */
  path: string | null;
  updated: boolean;
  added: string[];
};

const normalizeEntry = (line: string): string => line.trim();

/** Root profile glob as commonly written in .gitignore (`/.*\.env`). */
const ROOT_PROFILE_GLOB_ESCAPED = "/.*\\.env";
const ROOT_PROFILE_GLOB = "/.*.env";

/** True if `entry` (or an equivalent pattern) already appears as a gitignore line. */
export const gitignoreHasEntry = (text: string, entry: string): boolean => {
  const wanted = normalizeEntry(entry);
  const equivalents = new Set([wanted]);
  // `/.*\.env` (escaped dot) ≡ `/.*.env`
  if (wanted === ROOT_PROFILE_GLOB || wanted === ROOT_PROFILE_GLOB_ESCAPED) {
    equivalents.add(ROOT_PROFILE_GLOB);
    equivalents.add(ROOT_PROFILE_GLOB_ESCAPED);
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = normalizeEntry(raw);
    if (!line || line.startsWith("#")) continue;
    if (equivalents.has(line)) return true;
  }
  return false;
};

const buildManagedBlock = (extraEntries: string[]): string => {
  const seen = new Set<string>();
  const body: string[] = [];
  for (const entry of [...ENVMNG_GITIGNORE_CORE, ...extraEntries]) {
    if (seen.has(entry)) continue;
    seen.add(entry);
    body.push(entry);
  }
  return [BEGIN, "# managed by envmng (init / create)", ...body, END].join("\n");
};

/**
 * Ensure envmng ignore rules exist in root `.gitignore`.
 * No-ops when the file is missing (does not create one).
 */
export const ensureGitignore = (
  root: string,
  options: { profileName?: string } = {}
): EnsureGitignoreResult => {
  const path = resolve(root, ".gitignore");
  if (!existsSync(path)) {
    return { path: null, updated: false, added: [] };
  }

  const original = readFileSync(path, "utf8");
  const extras: string[] = [];
  if (options.profileName) {
    extras.push(`/.${options.profileName}.env`);
  }

  const missing = [...ENVMNG_GITIGNORE_CORE, ...extras].filter(
    entry => !gitignoreHasEntry(original, entry)
  );

  if (missing.length === 0) {
    return { path, updated: false, added: [] };
  }

  const begin = original.indexOf(BEGIN);
  const end = original.indexOf(END);

  let next: string;
  if (begin >= 0 && end > begin) {
    // Canonical refresh of the managed block (full core + profile extras).
    const block = buildManagedBlock(extras);
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
