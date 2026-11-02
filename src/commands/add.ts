import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { ensureRootExample, formatUpsertLog, upsertEnvFile } from "../catalogue/index.ts";
import { assertEnvName, namedEnvFile } from "../core/names.ts";
import { assertEnvKey, parseEnvFile, upsertEnvKey } from "../core/parse.ts";
import { listExistingProfileNames } from "../workspace/consumers.ts";

export type AddOptions = {
  root: string;
  name: string;
  key: string;
  value: string;
  /** Also upsert the key into other root `.envmng.{name}` profiles that lack it. */
  syncProfiles: boolean;
};

export type AddInput = {
  root: string;
  name?: string;
  key?: string;
  /** `undefined` = missing; empty string is a valid value. */
  value?: string;
  syncProfiles?: boolean;
};

/**
 * Introduce KEY into the root env catalogue + a named profile:
 * root `.env.example` (empty declaration) and root `.envmng.{name}` (value).
 * Generated files and the active profile remain unchanged.
 * Consumer templates: edit `.env.example` or use `check --fix`.
 */
export const addEnvKey = async ({ root, name, key, value, syncProfiles }: AddOptions): Promise<void> => {
  assertEnvName(name);
  assertEnvKey(key);

  console.log(`→ catalogue`);
  console.log(ensureRootExample(root, key).message);

  console.log(`\n→ profile ${name}`);
  const file = namedEnvFile(name);
  const path = resolve(root, file);
  if (!existsSync(path)) {
    console.log(`created ${file}`);
  }
  console.log(formatUpsertLog(file, upsertEnvFile(path, key, value, ""), key));

  if (syncProfiles) {
    const others = listExistingProfileNames(root).filter((n) => n !== name && existsSync(resolve(root, namedEnvFile(n))));
    for (const other of others) {
      const otherFile = namedEnvFile(other);
      const otherPath = resolve(root, otherFile);
      const previous = readFileSync(otherPath, "utf8");
      if (parseEnvFile(previous).has(key)) {
        console.log(`ok ${key} already in ${otherFile}`);
        continue;
      }
      const { text } = upsertEnvKey(previous, key, value);
      writeFileSync(otherPath, text, "utf8");
      console.log(`added ${key} in ${otherFile}`);
    }
  }

  console.log(`\nProfile updated. To validate and apply: envmng check ${name} && envmng set ${name}`);
};
