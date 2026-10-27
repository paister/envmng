import { copyFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { ensureGitignore, logGitignoreResult } from "../gitignore.ts";
import { assertEnvName, namedEnvFile } from "../names.ts";
import { consumerRelPath, listConsumerDirs } from "../workspace.ts";

export type CreateOptions = {
  root: string;
  name: string;
  force: boolean;
  /** Suppress the trailing "edit then set" hint (e.g. when init continues). */
  quiet?: boolean;
};

/** Copy .env.example into named profile files at repo root and under each consumer. */
export const createEnv = ({ root, name, force, quiet = false }: CreateOptions): void => {
  assertEnvName(name);
  const file = namedEnvFile(name);
  const rootExample = resolve(root, ".env.example");
  const rootTarget = resolve(root, file);

  if (!existsSync(rootExample)) {
    throw new Error(`Missing root .env.example (template for central values).`);
  }

  logGitignoreResult(ensureGitignore(root, { profileName: name }));

  if (existsSync(rootTarget) && !force) {
    console.log(`skip ${file} (exists; use --force to overwrite)`);
  } else {
    const existed = existsSync(rootTarget);
    copyFileSync(rootExample, rootTarget);
    console.log(`${existed ? "overwrote" : "created"} ${file} from .env.example`);
  }

  let skipped = 0;
  for (const dir of listConsumerDirs(root)) {
    const example = join(dir, ".env.example");
    const target = join(dir, file);
    const relPath = consumerRelPath(root, dir);

    if (existsSync(target) && !force) {
      console.log(`skip ${relPath}/${file} (exists)`);
      skipped += 1;
      continue;
    }
    copyFileSync(example, target);
    console.log(`created ${relPath}/${file} from .env.example`);
  }

  if (!quiet) {
    console.log(`\nEnv "${name}" ready. Edit ${file}, then: pnpm envmng set ${name}`);
  }
  if (skipped > 0) console.log(`(${skipped} consumer templates already existed)`);
};
