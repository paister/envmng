import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { formatEnvFile } from "../format.ts";
import { NAMED_ENV_FILE_RE } from "../names.ts";
import { consumerRelPath, listConsumerDirs } from "../workspace.ts";

/** Format existing env files in the root and known consumer directories in place. */
export const formatEnv = ({ root }: { root: string }): void => {
  let changed = 0;
  let total = 0;
  for (const dir of [root, ...listConsumerDirs(root)]) {
    const files = readdirSync(dir, { withFileTypes: true })
      .filter(
        entry =>
          entry.isFile() &&
          (entry.name === ".env" ||
            entry.name === ".env.example" ||
            NAMED_ENV_FILE_RE.test(entry.name))
      )
      .map(entry => entry.name)
      .sort();
    for (const file of files) {
      const path = join(dir, file);
      const text = readFileSync(path, "utf8");
      const formatted = formatEnvFile(text);
      total++;
      if (formatted === text) continue;
      writeFileSync(path, formatted, "utf8");
      console.log(`formatted ${consumerRelPath(root, path)}`);
      changed++;
    }
  }
  console.log(`Formatted ${changed} of ${total} env file(s).`);
};
