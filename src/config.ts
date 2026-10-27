import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnvFile, removeEnvKey, upsertEnvKey } from "./parse.ts";

export const ENVMNG_CONFIG_FILE = ".envmng";
/** Active profile key inside `.envmng`. */
export const ENVMNG_CONFIG_ENV_KEY = "ENV";

const HEADER = "# Managed by envmng";

const configPath = (root: string): string => resolve(root, ENVMNG_CONFIG_FILE);

/** Read `ENV` from root `.envmng`, or `null` if missing / unset. */
export const readActiveEnv = (root: string): string | null => {
  const path = configPath(root);
  if (!existsSync(path)) return null;
  const value = parseEnvFile(readFileSync(path, "utf8")).get(ENVMNG_CONFIG_ENV_KEY)?.trim();
  return value || null;
};

/** Upsert `ENV=<name>` in root `.envmng` (preserves other keys / comments). */
export const writeActiveEnv = (root: string, name: string): void => {
  const path = configPath(root);
  const existing = existsSync(path) ? readFileSync(path, "utf8") : `${HEADER}\n`;
  const { text } = upsertEnvKey(existing, ENVMNG_CONFIG_ENV_KEY, name);
  writeFileSync(path, text, "utf8");
};

/**
 * If `.envmng` has `ENV=<name>`, remove that key.
 * Deletes the file when nothing but blank/comment lines remain.
 */
export const clearActiveEnvIf = (root: string, name: string): boolean => {
  const path = configPath(root);
  if (!existsSync(path)) return false;
  const current = readActiveEnv(root);
  if (current !== name) return false;

  const { text, removed } = removeEnvKey(readFileSync(path, "utf8"), ENVMNG_CONFIG_ENV_KEY);
  if (!removed) return false;

  const hasAssignments = [...parseEnvFile(text).keys()].length > 0;
  if (!hasAssignments) {
    unlinkSync(path);
  } else {
    writeFileSync(path, text, "utf8");
  }
  return true;
};
