import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

/** Dirs skipped while walking app sources. */
export const SCAN_SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  ".nuxt",
  ".output",
  ".turbo",
  ".vercel",
  ".vinxi",
  "dist",
  "build",
  "out",
  "coverage",
  "storybook-static",
]);

/**
 * Test-only dirs — not part of the app runtime env contract.
 * Keys referenced only here should not force entries in `.env.example`.
 */
export const SCAN_SKIP_TEST_DIRS = new Set([
  "tests",
  "test",
  "__tests__",
  "e2e",
  "spec",
  "__mocks__",
]);

const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"]);

/** `*.test.ts`, `*.spec.tsx`, … */
const TEST_FILE_RE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Vite `import.meta.env` builtins — not expected in .env.example. */
export const VITE_META_BUILTINS = new Set(["MODE", "DEV", "PROD", "SSR", "BASE_URL"]);

const DOT_ACCESS = /(process\.env|import\.meta\.env)\.([A-Za-z_][A-Za-z0-9_]*)/g;
const BRACKET_ACCESS =
  /(process\.env|import\.meta\.env)\[\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\]/g;

/**
 * Extract static env key references from source text.
 * Dynamic access (`process.env[key]`) is invisible to this scanner.
 */
export const extractEnvKeysFromSource = (text: string): Set<string> => {
  const keys = new Set<string>();
  for (const re of [DOT_ACCESS, BRACKET_ACCESS]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(text)) !== null) {
      const key = match[2];
      if (!key) continue;
      if (match[1] === "import.meta.env" && VITE_META_BUILTINS.has(key)) continue;
      keys.add(key);
    }
  }
  return keys;
};

export type ListSourceOptions = {
  /** Include `tests/`, `*.test.ts`, etc. Default false (runtime contract only). */
  includeTests?: boolean;
};

const shouldSkipDir = (name: string, includeTests: boolean): boolean => {
  if (SCAN_SKIP_DIRS.has(name)) return true;
  if (!includeTests && SCAN_SKIP_TEST_DIRS.has(name)) return true;
  return false;
};

/** Recursively list source file paths under `dir`. */
export const listSourceFiles = (dir: string, options: ListSourceOptions = {}): string[] => {
  const includeTests = Boolean(options.includeTests);
  if (!existsSync(dir)) return [];
  const out: string[] = [];

  const walk = (current: string) => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const name = entry.name;
      const full = join(current, name);
      if (entry.isDirectory()) {
        if (shouldSkipDir(name, includeTests)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!SOURCE_EXTS.has(extname(name))) continue;
      if (!includeTests && TEST_FILE_RE.test(name)) continue;
      out.push(full);
    }
  };

  // If `dir` itself is a file, include it.
  try {
    if (statSync(dir).isFile()) {
      if (SOURCE_EXTS.has(extname(dir))) return [dir];
      return [];
    }
  } catch {
    return [];
  }

  walk(dir);
  return out.sort();
};

/** Union of env keys referenced under an app (or any) directory. */
export const collectUsedEnvKeys = (
  dir: string,
  options: { ignore?: ReadonlySet<string>; includeTests?: boolean } = {}
): { keys: Set<string>; filesScanned: number } => {
  const ignore = options.ignore ?? new Set<string>();
  const keys = new Set<string>();
  const files = listSourceFiles(dir, { includeTests: options.includeTests });
  for (const file of files) {
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue;
    }
    for (const key of extractEnvKeysFromSource(text)) {
      if (ignore.has(key)) continue;
      keys.add(key);
    }
  }
  return { keys, filesScanned: files.length };
};
