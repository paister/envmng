import { existsSync, unlinkSync } from "node:fs";
import { join, resolve } from "node:path";
import { clearActiveEnvIf, ENVMNG_CONFIG_FILE } from "../config.ts";
import { confirmByTyping } from "../confirm.ts";
import { assertEnvName, namedEnvFile } from "../names.ts";
import { listConsumerDirs } from "../workspace.ts";
import { AbortedError } from "./set.ts";

export type DeleteOptions = {
  root: string;
  name: string;
  /** Skip interactive confirm (CI). */
  yes: boolean;
};

const tryUnlink = (path: string): boolean => {
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
};

/** Delete an entire named profile (root + consumer profile files). Requires typing the name unless --yes. */
export const deleteEnv = async ({ root, name, yes }: DeleteOptions): Promise<void> => {
  assertEnvName(name);
  const file = namedEnvFile(name);

  const targets: string[] = [];
  const rootPath = resolve(root, file);
  if (existsSync(rootPath)) targets.push(rootPath);

  for (const dir of listConsumerDirs(root)) {
    const path = join(dir, file);
    if (existsSync(path)) targets.push(path);
  }

  if (targets.length === 0) {
    throw new Error(`No ${file} files found under root or consumers.`);
  }

  console.log(`Will delete ${targets.length} file(s):`);
  for (const path of targets) {
    const rel = path.startsWith(root) ? path.slice(root.length + 1) : path;
    console.log(`  - ${rel || file}`);
  }

  if (!yes) {
    const ok = await confirmByTyping(
      name,
      `\nDelete profile "${name}" permanently?\nType the profile name (${name}) to confirm: `
    );
    if (!ok) throw new AbortedError("Aborted.");
  }

  let deleted = 0;
  for (const path of targets) {
    if (tryUnlink(path)) {
      const rel = path.startsWith(root) ? path.slice(root.length + 1) : path;
      console.log(`deleted ${rel || file}`);
      deleted += 1;
    }
  }

  if (clearActiveEnvIf(root, name)) {
    console.log(`cleared ${ENVMNG_CONFIG_FILE} ENV=${name}`);
  }

  console.log(`\nRemoved profile "${name}" (${deleted} file(s)).`);
  console.log("Generated .env files were left untouched — run: pnpm envmng set <other>");
};
