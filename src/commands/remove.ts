import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { assertEnvName, namedEnvFile } from "../names.ts";
import { assertEnvKey, removeEnvKey } from "../parse.ts";

export type RemoveOptions = {
  root: string;
  name: string;
  key: string;
};

/** Remove KEY from the root named profile file. */
export const removeEnvVar = ({ root, name, key }: RemoveOptions): void => {
  assertEnvName(name);
  assertEnvKey(key);

  const file = namedEnvFile(name);
  const path = resolve(root, file);
  if (!existsSync(path)) {
    throw new Error(`Missing ${file}. Nothing to remove.`);
  }

  const previous = readFileSync(path, "utf8");
  const { text, removed } = removeEnvKey(previous, key);
  if (!removed) {
    console.log(`skip ${key} — not found in ${file}`);
    return;
  }

  writeFileSync(path, text, "utf8");
  console.log(`removed ${key} from ${file}`);
  console.log(`Run: pnpm envmng set ${name}`);
};
