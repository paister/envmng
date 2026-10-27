import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { namedEnvFile, profileNameFromFilename } from "./names.ts";
import { parseEnvFile, upsertEnvKey } from "./parse.ts";

export type UpsertResult = { existed: boolean; created: boolean };

const consumerExampleHeader = (consumerRel: string): string =>
  [`# ${consumerRel} — template for \`pnpm envmng create <name>\`.`, `# Copies to ${consumerRel}/.<name>.env; placeholders filled from root .<name>.env on set.`, ""].join("\n");

const listConsumerProfileNames = (consumerDir: string): string[] => {
  const names: string[] = [];
  for (const entry of readdirSync(consumerDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const name = profileNameFromFilename(entry.name);
    if (name) names.push(name);
  }
  return names.sort();
};

export const upsertEnvFile = (path: string, key: string, value: string, createIfMissing: string | null): UpsertResult => {
  let created = false;
  let previous = "";
  if (!existsSync(path)) {
    if (createIfMissing === null) {
      throw new Error(`Missing file: ${path}`);
    }
    previous = createIfMissing;
    created = true;
  } else {
    previous = readFileSync(path, "utf8");
  }
  const { text, existed } = upsertEnvKey(previous, key, value);
  writeFileSync(path, text, "utf8");
  return { existed, created };
};

export const formatUpsertLog = (label: string, result: UpsertResult, key: string): string => {
  const verb = result.created ? "created" : result.existed ? "updated" : "added";
  return `${verb} ${key} in ${label}`;
};

/**
 * Declare new root example keys with empty values; never copy profile values.
 * When the key already exists, leaves the sample value alone.
 */
export const ensureRootExample = (root: string, key: string): { changed: boolean; message: string } => {
  const path = resolve(root, ".env.example");
  if (!existsSync(path)) {
    return { changed: false, message: "skip .env.example (not found)" };
  }
  const previous = readFileSync(path, "utf8");
  if (parseEnvFile(previous).has(key)) {
    return { changed: false, message: `ok ${key} already in .env.example` };
  }
  const { text } = upsertEnvKey(previous, key, "");
  writeFileSync(path, text, "utf8");
  return { changed: true, message: `added ${key} in .env.example` };
};

/**
 * Ensure a consumer's templates declare `KEY={{KEY}}` (.env.example + existing profile templates).
 * `consumerRel` is the path relative to the monorepo root (e.g. `apps/workers`, `services/api`).
 */
export const ensureConsumerTemplates = (root: string, consumerRel: string, key: string): { changed: boolean; messages: string[] } => {
  const consumerDir = resolve(root, consumerRel);
  if (!existsSync(consumerDir)) {
    throw new Error(`Unknown consumer "${consumerRel}"`);
  }

  const placeholder = `{{${key}}}`;
  const messages: string[] = [];
  let changed = false;

  const examplePath = join(consumerDir, ".env.example");
  const ex = upsertEnvFile(examplePath, key, placeholder, consumerExampleHeader(consumerRel));
  if (!ex.existed || ex.created) changed = true;
  messages.push(formatUpsertLog(`${consumerRel}/.env.example`, ex, key));

  for (const profile of listConsumerProfileNames(consumerDir)) {
    const file = namedEnvFile(profile);
    const result = upsertEnvFile(join(consumerDir, file), key, placeholder, null);
    if (!result.existed) changed = true;
    messages.push(formatUpsertLog(`${consumerRel}/${file}`, result, key));
  }

  return { changed, messages };
};

/**
 * Parent directory of an issue file path like `apps/workers/.env.example`
 * or `services/api/.local.env`.
 */
export const consumerRelFromIssueFile = (file: string | undefined): string | null => {
  if (!file) return null;
  const normalized = file.split(/[/\\]/).join("/");
  const idx = normalized.lastIndexOf("/");
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
};
